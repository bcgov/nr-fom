import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { AwsCognitoConfig } from "@api-client";
import { User } from "@utility/security/user";
import { ConfigService } from "@utility/services/config.service";
import { Amplify, ResourcesConfig } from "aws-amplify";
import { fetchAuthSession, getCurrentUser, signInWithRedirect, signOut } from "aws-amplify/auth";
import { jwtDecode } from "jwt-decode";
import { lastValueFrom, Observable } from "rxjs";
import { buildFederatedLogoutUrl, FederatedLogoutConfig } from "../utils/logout-chain";
import { getFakeUser } from "./mock-user";

export interface CognitoAuthToken { 
  decodedIdToken: { [id: string]: any }  // decoded jwt payload
  decodedAccessToken: { [id: string]: any } // decoded jwt payload
  jwtToken: { idToken: string; accessToken: string }; // raw tokens
}

@Injectable({
    providedIn: 'root'
})
export class CognitoService {
  private configService = inject(ConfigService);
  private http = inject(HttpClient);

  public awsCognitoConfig: AwsCognitoConfig;
  private loadRemoteConfigPromise: Promise<void> | null = null;
  private cognitoAuthToken: CognitoAuthToken;
  public loggedOut = false;
  private fakeUser: User | null;
  public initialized: boolean = false;

  public isLogoutLanding(): boolean {
    return window.location.pathname.replace(/\/+$/, '').endsWith('/logout');
  }

  /*
      See Aws-Amplify documenation for intgration: 
      https://docs.amplify.aws/lib/auth/social/q/platform/js/
      https://docs.amplify.aws/lib/auth/advanced/q/platform/js/#identity-pool-federation
  */
  public async init(): Promise<any> {
    // Loop-breaker: the logout landing must not bootstrap auth.
    this.loggedOut = this.isLogoutLanding();
    if (this.loggedOut) {
      this.initialized = false;
      return null;
    }
    else {
      await this.loadRemoteConfig()
      if (!this.awsCognitoConfig.enabled) {
        this.fakeUser = getFakeUser();
        this.initialized = true;
        return null;
      }
      return new Promise<any>((resolve) => {
        return getCurrentUser()
          .then(async () => {
              console.log("Signed in...");
              await this.refreshToken();
              this.initialized = true;
              resolve(null)
          })
          .catch((error) => {
              console.log(error);
              this.login();
              // resolve(null) no need for resolve as it will gets redirected.
          })            
      });
    }
  }

  /**
   * Automatically logout if unable to get currentSession().
   */
  async refreshToken() {
    try {
      this.cognitoAuthToken = await this.refreshAndObtainAwsCognitoUserSession();
    } catch (error) {
      console.error("Problem refreshing token or token is invalidated:", error);
      // logout and redirect to login.
      await this.logout();
    }
  }

  updateToken(): Observable<any> {
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

  public async login() {
    await signInWithRedirect();
  }

  public async logout() {
    console.log("User logged out.");
    if (!this.awsCognitoConfig?.enabled) {
      this.fakeUser = null;
      return;
    }

    const chainUrl = buildFederatedLogoutUrl(
      this.toFederatedLogoutConfig(),
      this.getIdpProvider()
    );
    if (chainUrl) {
      this.clearStoredTokens();
      this.navigateTo(chainUrl);
      return;
    }

    // Fallback. Plain Cognito-only sign-out. Amplify redirects to
    // oauth.redirectSignOut, which is the same /admin/logout landing.
    await signOut();
  }

  /**
   * Flattens the served config into the chain builder's input.
   *
   * appReturnUrl is oauth.redirectSignOut rather than a locally built
   * `origin + '/admin/logout'` so the chain's final hop and the Amplify fallback
   * cannot land on different URLs, and so it is exactly the string FAM allow-lists
   * as a Cognito sign-out URL.
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

  private navigateTo(url: string) {
    window.location.assign(url);
  }

  /**
   * The IdP the user signed in with, which selects the Keycloak client for the
   * end-session hop. Read from the already-decoded ID token rather than getUser(),
   * since User does not carry the IdP. Undefined when the session is gone.
   */
  private getIdpProvider(): string | undefined {
    return this.cognitoAuthToken?.decodedIdToken?.['custom:idp_name'];
  }

  /**
   * Drops Amplify's tokens for this app client so the post-chain landing bootstraps
   * logged out.
   */
  private clearStoredTokens() {
    try {
      const prefix = `CognitoIdentityServiceProvider.${this.awsCognitoConfig?.aws_user_pools_web_client_id}`;
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key?.startsWith(prefix)) {
          keys.push(key);
        }
      }
      keys.forEach((key) => window.localStorage.removeItem(key));
    } catch (error) {
      console.warn("Unable to clear stored Cognito tokens:", error);
    }
  }

  public getUser() {
    if (!this.initialized) {
      return null;
    }

    if (!this.awsCognitoConfig.enabled) {
      return this.fakeUser;
    }

    const token = this.getToken();
    if (!token) {
      return null;
    }
    const user = User.convertAwsCognitoDecodedTokenToUser(token);
    console.log("User " + JSON.stringify(user));
    return user;
  }

  public getToken() {
    if (!this.awsCognitoConfig.enabled) {
      return JSON.stringify(this.fakeUser);
    }
    return this.cognitoAuthToken;
  }

  private async loadRemoteConfig() {
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

          const amplifyConfig = this.toAmplifyConfig(this.awsCognitoConfig);
          console.log("Using amplify config = " + JSON.stringify(amplifyConfig));
          Amplify.configure(amplifyConfig);
        } catch (error) {
          this.loadRemoteConfigPromise = null;
          throw error;
        }
      })();
    }
    return this.loadRemoteConfigPromise;
  }

  private toAmplifyConfig(awsCognitoConfig: AwsCognitoConfig): ResourcesConfig {
    // conversion to config aws-amplify (gen 2)
    return {
      Auth: {
        Cognito: {
          userPoolClientId: awsCognitoConfig.aws_user_pools_web_client_id,
          userPoolId: awsCognitoConfig.aws_user_pools_id,
          loginWith: {
            oauth: {
              domain: awsCognitoConfig.oauth.domain,
              scopes: ['openid'],
              redirectSignIn: [awsCognitoConfig.oauth.redirectSignIn],
              redirectSignOut: [this.awsCognitoConfig.oauth.redirectSignOut],
              responseType: 'code',
            },
          }
        }
      }
    }
  }

  /**
   * Note:
   * `aws-amplify` (v6) does not expose previous CognitoUserSession (JWT Token) and it does not
   * expose 'refreshToken' anymore than previous v5.
   * @returns newly fetched session converted into Promise<CognitoAuthToken> type.
   */
  private async refreshAndObtainAwsCognitoUserSession(): Promise<CognitoAuthToken> {
    const authSession = await fetchAuthSession({ forceRefresh: true });
    const idToken = authSession.tokens?.idToken?.toString();
    const accessToken = authSession.tokens?.accessToken?.toString();
    if (!idToken || !accessToken) {
      throw new Error("Unable to obtain Cognito auth session tokens.");
    }
    return {
        decodedIdToken: jwtDecode(idToken),
        decodedAccessToken: jwtDecode(accessToken),
        jwtToken: { idToken, accessToken } // original raw tokens
    };
  }

}
