import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { AwsCognitoConfig } from "@api-client";
import { User } from "@utility/security/user";
import { ConfigService } from "@utility/services/config.service";
import {
    CognitoAccessToken,
    CognitoIdToken,
    CognitoUserSession
} from 'amazon-cognito-identity-js';
import { Amplify, ResourcesConfig } from "aws-amplify";
import { fetchAuthSession, getCurrentUser, signInWithRedirect, signOut } from "aws-amplify/auth";
import { lastValueFrom, Observable } from "rxjs";
import { getFakeUser } from "./mock-user";

export interface CognitoAuthToken { 
  id_token: { [id: string]: any }  // decoded jwt payload
  access_token: { [id: string]: any } // decoded jwt payload
  jwtToken: CognitoUserSession // original Cognito user session (tokens)
}

@Injectable({
    providedIn: 'root'
})
export class CognitoService {
  public awsCognitoConfig: AwsCognitoConfig;
  private cognitoAuthToken: CognitoAuthToken;
  private loggedOut: string;
  private fakeUser: User;
  public initialized: boolean = false;

  constructor(private configService: ConfigService, private http: HttpClient) {}

  /*
      See Aws-Amplify documenation for intgration: 
      https://docs.amplify.aws/lib/auth/social/q/platform/js/
      https://docs.amplify.aws/lib/auth/advanced/q/platform/js/#identity-pool-federation
  */
  public async init(): Promise<any> {
    this.loggedOut = this.getParameterByName("loggedout");
    if (this.loggedOut === "true") {
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
      const awsCognitoUserSession = await this.refreshAndObtainAwsCognitoUserSession();
      this.cognitoAuthToken = this.parseToken(awsCognitoUserSession);
    } catch (error) {
      console.error("Problem refreshing token or token is invalidated:", error);
      // logout and redirect to login.
      await this.logout();
    }
  }

  updateToken(): Observable<any> {
    return new Observable((observer) => {
      this.refreshAndObtainAwsCognitoUserSession()
        .then((refreshed) => {
          this.cognitoAuthToken = this.parseToken(refreshed);
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
    if (!this.awsCognitoConfig.enabled) {
      this.fakeUser = null;
      return;
    }
    await signOut();
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
    let url: string = this.configService.getApiBasePath() + "/api/awsCognitoConfig";
    this.awsCognitoConfig = await lastValueFrom(
      this.http.get(url, { observe: "body", responseType: "json" })
    ) as AwsCognitoConfig;

    const amplifyConfig = this.toAmplifyConfig(this.awsCognitoConfig);
    console.log("Using amplify config = " + JSON.stringify(amplifyConfig));
    Amplify.configure(amplifyConfig);
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

  private getParameterByName(name) {
    const url = window.location.href;
    const regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)");
    const results = regex.exec(url);
    if (!results) {
      return null;
    }
    if (!results[2]) {
      return "";
    }
    return decodeURIComponent(results[2].replace(/\+/g, " "));
  }

  /**
   * See OIDC Attribute Mapping mapping reference:
   *      https://github.com/bcgov/nr-forests-access-management/wiki/OIDC-Attribute-Mapping
   * The display username is "custom:idp_username" from token.
   */
  private parseToken(authToken: CognitoUserSession): CognitoAuthToken {
    console.log("authToken: ", authToken)
    const decodedIdToken = authToken.getIdToken().decodePayload();
    const decodedAccessToken = authToken.getAccessToken().decodePayload();
    return {
      id_token: decodedIdToken,
      access_token: decodedAccessToken,
      jwtToken: authToken
    };
  }

  /**
   * Note:
   * `aws-amplify` (v6) does not expose previous CognitoUserSession (JWT Token) and it does not
   * expose 'refreshToken' anymore than previous v5.
   * To get entire encoded token, calls to the 'toString()' is necessary (but is not documented 
   * on aws-amplify).
   * @returns newly fetched session converted into Promise<CognitoUserSession> type.
   */
  private async refreshAndObtainAwsCognitoUserSession(): Promise<CognitoUserSession> {
    const authSession = await fetchAuthSession({ forceRefresh: true });
    const cognitoUserSession = new CognitoUserSession( {
      IdToken: new CognitoIdToken({IdToken: authSession.tokens.idToken.toString()}),
      AccessToken: new CognitoAccessToken({AccessToken: authSession.tokens.accessToken.toString()}),
      // RefreshToken: /* aws-amplify v6 does not provide refreshToken anymore, only internally for aws-amplify*/
    })
    return cognitoUserSession;
  }

}
