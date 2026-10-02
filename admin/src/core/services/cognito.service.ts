import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { AwsCognitoConfig } from "@api-client";
import { User } from "@utility/security/user";
import { ConfigService } from "@utility/services/config.service";
import { OidcSecurityService, OpenIdConfiguration, StsConfigLoader } from "angular-auth-oidc-client";
import { firstValueFrom, lastValueFrom, Observable, of, throwError } from "rxjs";
import { buildCognitoLogoutUrl, buildFederatedLogoutUrl, FederatedLogoutConfig } from "../utils/logout-chain";
import { getFakeUser } from "./mock-user";

export interface CognitoAuthToken { 
  decodedIdToken: Record<string, unknown>;
  decodedAccessToken: Record<string, unknown>;
  jwtToken: { idToken: string; accessToken: string };
}

/**
 * Holds the OpenID config until CognitoService has fetched /api/awsCognitoConfig.
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

@Injectable({
    providedIn: 'root'
})
export class CognitoService {
  private configService = inject(ConfigService);
  private http = inject(HttpClient);
  private oidc = inject(OidcSecurityService);
  private stagedOidc = inject(StagedOidcConfig);

  public awsCognitoConfig: AwsCognitoConfig;
  private loadRemoteConfigPromise: Promise<void> | null = null;
  private cognitoAuthToken: CognitoAuthToken;
  public loggedOut = false;
  private fakeUser: User | null;
  public initialized: boolean = false;

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
    if (!this.awsCognitoConfig.enabled) {
      this.fakeUser = getFakeUser();
      this.initialized = true;
      return;
    }
    const openId = this.toOpenIdConfiguration(this.awsCognitoConfig);
    console.log("Using OIDC authority " + openId.authority);
    this.stagedOidc.config = openId;
    const login = await firstValueFrom(this.oidc.checkAuth());
    if (!login.isAuthenticated) {
      console.log(login.errorMessage ?? "Not signed in");
      await this.login();
      // The hosted UI redirect is in flight. Do not resolve: resolving lets the
      // app render a logged-out shell before the browser leaves.
      return new Promise(() => undefined);
    }
    console.log("Signed in...");
    await this.refreshToken();
    this.initialized = true;
  }

  /**
   * Automatically logout if unable to refresh the session.
   */
  async refreshToken(): Promise<void> {
    try {
      this.cognitoAuthToken = await this.refreshAndObtainAwsCognitoUserSession();
    } catch (error) {
      console.error("Problem refreshing token or token is invalidated:", error);
      await this.logout();
    }
  }

  updateToken(): Observable<void> {
    return new Observable((observer) => {
      this.refreshAndObtainAwsCognitoUserSession()
        .then((refreshedToken) => {
          this.cognitoAuthToken = refreshedToken;
          observer.next(undefined);
          observer.complete();
        })
        .catch((err) => {
          console.error("Cognito token refresh error:", err);
          observer.error();
        });

      return {
        unsubscribe() {
          // Deliberately empty
        },
      };
    });
  }

  /**
   * Cognito hosted UI. No identity_provider param: the page offers IDIR and BCeID.
   */
  public async login(): Promise<void> {
    this.oidc.authorize();
  }

  public async logout(): Promise<void> {
    console.log("User logged out.");
    if (!this.awsCognitoConfig?.enabled) {
      this.fakeUser = null;
      return;
    }

    const federated = this.toFederatedLogoutConfig();
    const chainUrl = buildFederatedLogoutUrl(federated, this.getIdpProvider());
    const target = chainUrl ?? buildCognitoLogoutUrl(federated);
    if (!target) {
      throw new Error("Cognito logout URL is not configured.");
    }
    // Local only. logoff() would send the browser to Cognito before Siteminder
    // and Keycloak, and Cognito's /logout does not accept OIDC end-session params.
    this.oidc.logoffLocal();
    this.navigateTo(target);
  }

  /**
   * Flattens the served config into the chain builder's input.
   *
   * appReturnUrl is oauth.redirectSignOut rather than a locally built
   * `origin + '/admin/logout'` so the chain's final hop and the Cognito-only
   * fallback cannot land on different URLs, and so it is exactly the string FAM
   * allow-lists as a Cognito sign-out URL.
   */
  private toFederatedLogoutConfig(): FederatedLogoutConfig {
    const logout = this.awsCognitoConfig?.logout;
    return {
      siteminderLogoutUrl: logout?.siteminderUrl ?? '',
      keycloakLogoutUrl: logout?.keycloakUrl ?? '',
      keycloakClientIdIdir: logout?.keycloakClientIdIdir ?? '',
      keycloakClientIdBceidBusiness: logout?.keycloakClientIdBceidBusiness ?? '',
      cognitoDomain: this.awsCognitoConfig?.oauth?.domain ?? '',
      cognitoClientId: this.awsCognitoConfig?.aws_user_pools_web_client_id ?? '',
      appReturnUrl: this.awsCognitoConfig?.oauth?.redirectSignOut ?? ''
    };
  }

  private navigateTo(url: string): void {
    window.location.assign(url);
  }

  /**
   * The IdP the user signed in with, which selects the Keycloak client for the
   * end-session hop. Read from the already-decoded ID token rather than getUser(),
   * since User does not carry the IdP. Undefined when the session is gone.
   */
  private getIdpProvider(): string | undefined {
    const idp = this.cognitoAuthToken?.decodedIdToken?.['custom:idp_name'];
    return typeof idp === 'string' ? idp : undefined;
  }

  public getUser(): User | null {
    if (!this.initialized) {
      return null;
    }

    if (!this.awsCognitoConfig.enabled) {
      return this.fakeUser;
    }

    if (!this.cognitoAuthToken) {
      return null;
    }
    const user = User.convertAwsCognitoDecodedTokenToUser(this.cognitoAuthToken);
    console.log("User " + JSON.stringify(user));
    return user;
  }

  public getToken(): CognitoAuthToken | string | undefined {
    if (!this.awsCognitoConfig.enabled) {
      return JSON.stringify(this.fakeUser);
    }
    return this.cognitoAuthToken;
  }

  private async loadRemoteConfig(): Promise<void> {
    if (this.awsCognitoConfig) {
      return;
    }
    if (!this.loadRemoteConfigPromise) {
      this.loadRemoteConfigPromise = (async () => {
        try {
          const url: string = this.configService.getApiBasePath() + "/api/awsCognitoConfig";
          this.awsCognitoConfig = await lastValueFrom(
            this.http.get(url, { observe: "body", responseType: "json" })
          ) as AwsCognitoConfig;
        } catch (error) {
          this.loadRemoteConfigPromise = null;
          throw error;
        }
      })();
    }
    return this.loadRemoteConfigPromise;
  }

  /**
   * Authority is the Cognito user-pool issuer. Its discovery document points
   * authorize, token, and logout at the hosted UI domain, which is what
   * federates IDIR and BCeID.
   */
  private toOpenIdConfiguration(aws: AwsCognitoConfig): OpenIdConfiguration {
    const region = aws.aws_cognito_region;
    const poolId = aws.aws_user_pools_id;
    const clientId = aws.aws_user_pools_web_client_id;
    const domain = aws.oauth?.domain;
    const redirectUrl = aws.oauth?.redirectSignIn;
    const postLogoutRedirectUri = aws.oauth?.redirectSignOut;
    const scope = aws.oauth?.scope;
    const responseType = aws.oauth?.responseType;
    if (
      !region ||
      !poolId ||
      !clientId ||
      !domain ||
      !redirectUrl ||
      !postLogoutRedirectUri ||
      !scope ||
      scope.length === 0 ||
      responseType !== "code"
    ) {
      throw new Error("Cognito OIDC config is incomplete.");
    }
    // Cognito refresh tokens are reusable until they expire, and the hosted UI
    // rejects the offline_access scope. customParamsAuthRequest is omitted so
    // the hosted UI keeps offering both IDIR and BCeID.
    return {
      configId: "fom-admin",
      authority: `https://cognito-idp.${region}.amazonaws.com/${poolId}`,
      clientId,
      redirectUrl,
      postLogoutRedirectUri,
      responseType: "code",
      scope: scope.join(" "),
      silentRenew: true,
      useRefreshToken: true,
      disableRefreshTokenOfflineAccessScopeWarning: true,
      allowUnsafeReuseRefreshToken: true,
      autoUserInfo: false,
      renewUserInfoAfterTokenRenew: false,
      triggerAuthorizationResultEvent: true,
    };
  }

  private async refreshAndObtainAwsCognitoUserSession(): Promise<CognitoAuthToken> {
    const refreshed = await firstValueFrom(this.oidc.forceRefreshSession());
    const idToken = refreshed.idToken;
    const accessToken = refreshed.accessToken;
    if (!refreshed.isAuthenticated || !idToken || !accessToken) {
      throw new Error("Unable to obtain Cognito auth session tokens.");
    }
    const decodedIdToken = await firstValueFrom(this.oidc.getPayloadFromIdToken());
    const decodedAccessToken = await firstValueFrom(this.oidc.getPayloadFromAccessToken());
    if (!decodedIdToken || !decodedAccessToken) {
      throw new Error("Unable to obtain Cognito auth session tokens.");
    }
    return {
      decodedIdToken,
      decodedAccessToken,
      jwtToken: { idToken, accessToken },
    };
  }

}
