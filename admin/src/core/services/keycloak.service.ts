import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { KeycloakConfig } from "@api-client";
import { User } from "@utility/security/user";
import { ConfigService } from "@utility/services/config.service";
import { OidcSecurityService, OpenIdConfiguration, StsConfigLoader } from "angular-auth-oidc-client";
import { firstValueFrom, lastValueFrom, Observable, of, throwError } from "rxjs";
import { buildLogoutChainUrl } from "../utils/logout-chain";
import { getFakeUser } from "./mock-user";

/** The tokens of the current session, with the verified-by-the-API access token decoded. */
export interface KeycloakSession {
  accessToken: string;
  idToken: string;
  /** Access-token claims. Profile claims and roles ride the access token on BC Gov SSO. */
  claims: Record<string, unknown>;
}

/** Route the realm returns to after sign-in; registered on the CSS integration. */
const SIGN_IN_PATH = '/admin/search';
/** Route the realm returns to after sign-out; registered on the CSS integration. */
const LOGOUT_PATH = '/admin/logout';
/** Key under which angular-auth-oidc-client persists its config and tokens in localStorage. */
const OIDC_CONFIG_ID = 'fom-admin';

/**
 * Holds the OpenID config until KeycloakService has fetched /api/keycloakConfig.
 * The OIDC client reads it on the first checkAuth(); the logout landing never stages it.
 */
@Injectable({ providedIn: "root" })
export class StagedOidcConfig {
  config: OpenIdConfiguration | null = null;
}

@Injectable()
export class StagedOidcConfigLoader implements StsConfigLoader {
  private staged = inject(StagedOidcConfig);

  loadConfigs(): Observable<OpenIdConfiguration[]> {
    const config = this.staged.config;
    if (!config) {
      return throwError(() => new Error("OIDC config was not staged"));
    }
    return of([config]);
  }
}

/**
 * BC Gov SSO (Keycloak, standard realm) sign-in for the admin app, via
 * angular-auth-oidc-client: Authorization Code + PKCE, public client.
 *
 * Issuer and client id come from the API (/api/keycloakConfig), so the SPA always
 * signs in against the realm and client the API validates. No kc_idp_hint is
 * sent: FOM serves both IDIR (ministry) and BCeID Business (forest clients), so
 * Keycloak shows its provider choice, as the Cognito hosted UI did.
 */
@Injectable({
    providedIn: 'root'
})
export class KeycloakService {
  private configService = inject(ConfigService);
  private http = inject(HttpClient);
  private oidc = inject(OidcSecurityService);
  private stagedOidc = inject(StagedOidcConfig);

  public keycloakConfig: KeycloakConfig;
  private loadRemoteConfigPromise: Promise<void> | null = null;
  private session: KeycloakSession | null = null;
  public loggedOut = false;
  private fakeUser: User | null;
  public initialized: boolean = false;
  /** This browser's clock minus the realm's, in ms. See measureClockOffset(). */
  private clockOffsetMs = 0;

  /** localStorage key for the last measured clock offset, so a reload can reuse it. */
  static readonly CLOCK_OFFSET_KEY = "fom_admin_clock_offset_ms";

  public isLogoutLanding(): boolean {
    return window.location.pathname.replace(/\/+$/, '').endsWith('/logout');
  }

  public async init(): Promise<void> {
    // Loop-breaker: the logout landing must not bootstrap auth.
    this.loggedOut = this.isLogoutLanding();
    if (this.loggedOut) {
      this.initialized = false;
      return;
    }
    await this.loadRemoteConfig();
    if (!this.keycloakConfig.enabled) {
      this.fakeUser = getFakeUser();
      this.initialized = true;
      return;
    }
    const openId = this.toOpenIdConfiguration(this.keycloakConfig);
    console.log("Using OIDC authority " + openId.authority);
    if (openId.authority) {
      KeycloakService.clearStaleStorage(openId.authority);
    }
    this.stagedOidc.config = openId;
    // Read before checkAuth(), which strips ?code=&state= from the address bar.
    const isSignInCallback = new URLSearchParams(window.location.search).has("code");
    this.clockOffsetMs = KeycloakService.readStoredClockOffset();
    const login = await firstValueFrom(this.oidc.checkAuth());
    if (!login.isAuthenticated) {
      console.log(login.errorMessage ?? "Not signed in");
      await this.login();
      // The realm redirect is in flight. Do not resolve: resolving lets the app
      // render a logged-out shell before the browser leaves.
      return new Promise(() => undefined);
    }
    console.log("Signed in...");
    // Use the session checkAuth already restored from storage rather than
    // forcing a refresh on every hard reload (#1200, #1201).
    try {
      this.session = await this.sessionFromExistingTokens(login.idToken, login.accessToken);
    } catch (error) {
      console.error("Problem reading restored session tokens:", error);
      await this.logout();
      return;
    }
    if (isSignInCallback) {
      // Tokens straight from the token endpoint: their iat is the realm's "now".
      this.measureClockOffset(this.session);
    }
    if (KeycloakService.isExpired(this.session, Date.now(), this.clockOffsetMs)) {
      // The API rejects an expired JWT with 403. Refresh now rather than send it;
      // if the realm will not refresh, sign in again (silent while the SSO
      // session lives) instead of leaving a dead session (#1209).
      try {
        this.session = await this.refreshSession();
      } catch (error) {
        console.error("Restored session is expired and could not be refreshed:", error);
        await this.reauthenticate();
        return new Promise(() => undefined);
      }
    }
    this.initialized = true;
  }

  /**
   * True when the access token's exp claim (seconds) is in the past on the
   * realm's clock. clockOffsetMs (browser clock minus the realm's) converts the
   * browser's now to the realm's, so a wrong PC clock does not make fresh tokens
   * look expired (or stale ones look valid).
   */
  static isExpired(session: KeycloakSession | null, nowMs: number = Date.now(), clockOffsetMs: number = 0): boolean {
    const exp = session?.claims?.['exp'];
    return typeof exp === "number" && exp <= Math.floor((nowMs - clockOffsetMs) / 1000);
  }

  /**
   * Record how far this browser's clock is from the realm's, using tokens that
   * were just issued: their iat is the realm's time of issue. Network latency
   * makes the browser look a second or two ahead, which only makes isExpired()
   * that much earlier. Stored so a reload of a restored session can use it.
   */
  private measureClockOffset(session: KeycloakSession, nowMs: number = Date.now()): void {
    const iat = session.claims?.["iat"];
    if (typeof iat !== "number") {
      return;
    }
    this.clockOffsetMs = nowMs - iat * 1000;
    window.localStorage.setItem(KeycloakService.CLOCK_OFFSET_KEY, String(this.clockOffsetMs));
  }

  private static readStoredClockOffset(): number {
    const stored = Number(window.localStorage.getItem(KeycloakService.CLOCK_OFFSET_KEY));
    return Number.isFinite(stored) ? stored : 0;
  }

  /**
   * Drop persisted OIDC state when its cached discovery issuer does not match
   * the configured authority (e.g. Cognito state left under the shared configId
   * after moving to Keycloak, or a cached dev realm after switching zones).
   * Without this, angular-auth-oidc-client merges the cached endpoints over the
   * fresh discovery document and fails with "Issuer mismatch".
   */
  private static clearStaleStorage(expectedAuthority: string): void {
    const raw = window.localStorage.getItem(OIDC_CONFIG_ID);
    if (!raw) {
      return;
    }
    let storedIssuer: string | undefined;
    try {
      const parsed = JSON.parse(raw) as { authWellKnownEndPoints?: { issuer?: unknown } } | null;
      if (typeof parsed?.authWellKnownEndPoints?.issuer === "string") {
        storedIssuer = parsed.authWellKnownEndPoints.issuer.trim().replace(/\/+$/, "");
      }
    } catch {
      // Corrupt JSON falls through and is cleared below.
    }
    if (storedIssuer !== expectedAuthority) {
      window.localStorage.removeItem(OIDC_CONFIG_ID);
      window.localStorage.removeItem(KeycloakService.CLOCK_OFFSET_KEY);
    }
  }

  /**
   * Drop the local OIDC tokens and start a fresh sign-in. Unlike logout(), this
   * does not end the SSO session, so the user normally comes straight back
   * signed in with valid tokens.
   */
  public async reauthenticate(): Promise<void> {
    this.oidc.logoffLocal();
    await this.login();
  }

  /**
   * Force-refresh the session. Logs out when the refresh fails.
   */
  async refreshToken(): Promise<void> {
    try {
      this.session = await this.refreshSession();
    } catch (error) {
      console.error("Problem refreshing token or token is invalidated:", error);
      await this.logout();
    }
  }

  /** Used by the HTTP interceptor on 403. */
  updateToken(): Observable<void> {
    return new Observable((observer) => {
      this.refreshSession()
        .then((refreshed) => {
          this.session = refreshed;
          observer.next(undefined);
          observer.complete();
        })
        .catch((err) => {
          console.error("Token refresh error:", err);
          // Without this the session stays dead: stored tokens keep failing
          // with 403 even across reloads. Re-sign-in instead.
          this.reauthenticate().catch((e) => console.error("Re-sign-in failed:", e));
          observer.error(err);
        });

      return {
        unsubscribe() {
          // Deliberately empty
        },
      };
    });
  }

  public async login(): Promise<void> {
    this.oidc.authorize();
  }

  /**
   * Signs out of Siteminder, then Keycloak, then lands on /admin/logout.
   * The ID token is read before the local session is cleared (see logout-chain.ts).
   */
  public async logout(): Promise<void> {
    console.log("User logged out.");
    if (!this.keycloakConfig?.enabled) {
      this.fakeUser = null;
      return;
    }

    const postLogoutRedirectUri = window.location.origin + LOGOUT_PATH;
    const target = buildLogoutChainUrl({
      issuerUri: this.keycloakConfig.issuerUri ?? '',
      clientId: this.keycloakConfig.clientId ?? '',
      postLogoutRedirectUri,
      idToken: this.session?.idToken,
    });
    this.oidc.logoffLocal();
    this.session = null;
    this.navigateTo(target ?? postLogoutRedirectUri);
  }

  private navigateTo(url: string): void {
    window.location.assign(url);
  }

  public getUser(): User | null {
    if (!this.initialized) {
      return null;
    }

    if (!this.keycloakConfig.enabled) {
      return this.fakeUser;
    }

    if (!this.session) {
      return null;
    }
    return User.convertKeycloakClaimsToUser(this.session.claims);
  }

  /**
   * The value for the API's Bearer header: the access token, or with security
   * disabled the fake user as JSON. Read from the OIDC client each time, so a
   * background silent renew is picked up without waiting for a 403.
   */
  public async getBearerToken(): Promise<string | undefined> {
    if (!this.keycloakConfig?.enabled) {
      return this.fakeUser ? JSON.stringify(this.fakeUser) : undefined;
    }
    try {
      const current = await firstValueFrom(this.oidc.getAccessToken());
      if (current) {
        return current;
      }
    } catch (error) {
      console.error("Could not read the current access token:", error);
    }
    return this.session?.accessToken;
  }

  private async loadRemoteConfig(): Promise<void> {
    if (this.keycloakConfig) {
      return;
    }
    if (!this.loadRemoteConfigPromise) {
      this.loadRemoteConfigPromise = (async () => {
        try {
          const url: string = this.configService.getApiBasePath() + "/api/keycloakConfig";
          this.keycloakConfig = await lastValueFrom(
            this.http.get(url, { observe: "body", responseType: "json" })
          ) as KeycloakConfig;
        } catch (error) {
          this.loadRemoteConfigPromise = null;
          throw error;
        }
      })();
    }
    return this.loadRemoteConfigPromise;
  }

  /**
   * Authority is the realm issuer; the library discovers authorize, token and
   * end-session from it. Redirect URIs are derived from this origin so one
   * image serves PR previews, TEST and PROD.
   */
  private toOpenIdConfiguration(config: KeycloakConfig): OpenIdConfiguration {
    const authority = config.issuerUri?.trim().replace(/\/+$/, '');
    const clientId = config.clientId;
    if (!authority || !clientId) {
      throw new Error("Keycloak OIDC config is incomplete.");
    }
    return {
      configId: OIDC_CONFIG_ID,
      authority,
      clientId,
      redirectUrl: window.location.origin + SIGN_IN_PATH,
      postLogoutRedirectUri: window.location.origin + LOGOUT_PATH,
      responseType: "code",
      scope: "openid",
      silentRenew: true,
      useRefreshToken: true,
      // Keycloak issues refresh tokens without offline_access, and an offline
      // token would outlive the SSO session.
      disableRefreshTokenOfflineAccessScopeWarning: true,
      // Everything FOM needs is on the access token.
      autoUserInfo: false,
      renewUserInfoAfterTokenRenew: false,
      triggerAuthorizationResultEvent: true,
      // The library checks the ID token's iat (within 120 s) and exp against
      // this PC's clock, with no setting to widen the exp check. A PC clock an
      // hour off (old time zone data after BC stopped changing clocks) failed
      // every sign-in, so checkAuth() came back signed out and init() sent the
      // browser to the login again: an endless redirect loop (#1240). The API
      // verifies the access token's signature, issuer, client and expiry on
      // every request with the server's clock, and these tokens come straight
      // from the realm's token endpoint over TLS (code flow with PKCE and state).
      disableIdTokenValidation: true,
    };
  }

  /**
   * Build the session from tokens already held by the OIDC client (after
   * checkAuth or a refresh), without calling the token endpoint.
   */
  private async sessionFromExistingTokens(
    idToken: string | undefined,
    accessToken: string | undefined
  ): Promise<KeycloakSession> {
    if (!idToken || !accessToken) {
      throw new Error("Unable to obtain session tokens.");
    }
    const claims = await firstValueFrom(this.oidc.getPayloadFromAccessToken());
    if (!claims) {
      throw new Error("Unable to decode the access token.");
    }
    return { accessToken, idToken, claims };
  }

  private async refreshSession(): Promise<KeycloakSession> {
    const refreshed = await firstValueFrom(this.oidc.forceRefreshSession());
    if (!refreshed.isAuthenticated) {
      throw new Error("Unable to refresh the session.");
    }
    const session = await this.sessionFromExistingTokens(refreshed.idToken, refreshed.accessToken);
    this.measureClockOffset(session);
    return session;
  }

}
