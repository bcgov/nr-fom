import { createParamDecorator, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { decode, verify } from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { PinoLogger } from 'nestjs-pino';

import { User } from '@utility/security/user';


// Both of these decorators requires the global AuthInterceptor to add the User object to the request. If no bearer token is provided, the user object will be null.
/**
 * Use this decorator when anonmyous access is permitted.
 */
export const UserHeader = createParamDecorator( (data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.headers['user'];
});

/**
 * Use this decorator when authenticated access is required.
 */
export const UserRequiredHeader = createParamDecorator( (data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.headers['user'];
  if (user == null) {
    throw new ForbiddenException(); 
  }
  return user;
});

export class KeycloakConfig {
    @ApiProperty()
    enabled: boolean = true;

    // Keycloak Server URL
    @ApiProperty()
    url: string;

    @ApiProperty()
    siteMinderUrl: string;

    @ApiProperty()
    realm: string;

    @ApiProperty()
    clientId: string = 'fom';

    getIssuer(): string {
      return this.url + "/realms/" + this.realm;
    }

    getCertsUri(): string {
      return this.getIssuer() + "/protocol/openid-connect/certs";
    }
  }

@Injectable()
export class AuthService {
    private config:KeycloakConfig = new KeycloakConfig();

    private jwksClient;

    constructor(private logger: PinoLogger) {
        // Defaults are for local development. Keycloak enabled by default for maximum security.
        this.config.enabled = (process.env.KEYCLOAK_ENABLED || 'true') === 'true';
        this.config.realm = process.env.KEYCLOAK_REALM || 'ichqx89w';
        this.config.url = process.env.KEYCLOAK_URL || 'https://dev.oidc.gov.bc.ca/auth';
        this.config.siteMinderUrl = process.env.SITEMINDER_URL || 'https://logontest7.gov.bc.ca';
        // Sample User = {"isMinistry":true,"isForestClient":true,"clientIds":[1011, 1012],"userName":"fakeuser@idir","displayName":"Longlastname, Firstname"}
        // Other values for Keycloak URL: TEST: https://test.oidc.gov.bc.ca/auth, PROD: https://oidc.gov.bc.ca/auth

        this.logger.info("Keycloak configuration %o", this.config);

        this.jwksClient = new JwksClient({
          jwksUri: this.config.getCertsUri(),
          cache: true, // Accept cache defaults
          rateLimit: true,
        });

    }

    getKeycloakConfig():KeycloakConfig {
        return this.config;
    }

    async verifyToken(authHeader: string):Promise<User> {
        const bearer = 'Bearer ';
        if (!authHeader || !authHeader.startsWith(bearer) || authHeader.length <= bearer.length) {
          return Promise.reject(new ForbiddenException());
        }
        const tokenStartIndex = bearer.length;
        const token = authHeader.substr(tokenStartIndex);
        if (!this.config.enabled) {
          const user = User.convertJsonToUser(token);
          return Promise.resolve(user);
        }
        
        try {
          const untrustedDecodedToken = decode(token, { complete: true });
          this.logger.debug("Untrusted decoded token %o", untrustedDecodedToken);
          const kid = untrustedDecodedToken.header.kid;
          var key = await this.jwksClient.getSigningKey(kid);
          const nonce = untrustedDecodedToken.payload['nonce']; // Workaround weird typing of payload able to be a string.
          this.logger.debug("Nonce %o", nonce);
          var decodedToken = verify(token, key.getPublicKey(), 
            { issuer: this.config.getIssuer(), 
              nonce: nonce
            });
          this.logger.debug("Trusted decoded token = %o", decodedToken);
          return User.convertJwtToUser(decodedToken);
        } catch (err) {
          this.logger.warn("Invalid token %o", err);
          return Promise.reject(new ForbiddenException());
        }
    }
}
