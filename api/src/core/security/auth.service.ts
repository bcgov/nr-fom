import { ForbiddenException, Injectable } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { decode, verify } from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { PinoLogger } from 'nestjs-pino';

import { User } from '@utility/security/user';
import * as aswCognitoEnvJson from '../../assets/aws-cognito-env.json';

export class AwsCognitoConfig {

  @ApiProperty()
  enabled: boolean = true;

  @ApiProperty()
  aws_cognito_domain: string;

  @ApiProperty()
  aws_cognito_region: string;

  @ApiProperty()
  aws_user_pools_id: string;

  @ApiProperty()
  aws_user_pools_web_client_id: string;

  @ApiProperty()
  aws_mandatory_sign_in: string = "enable"; // 'enable' or 'disable'

  @ApiProperty({ type: () => AwsCognitoOauthConfig })
  oauth: AuthAwsCognitoConfig = new AwsCognitoOauthConfig();

  @ApiProperty()
  federationTarget: string = 'COGNITO_USER_POOLS';
}

export interface AuthAwsCognitoConfig {
  domain: string;
  scope: string[];
  redirectSignIn: string;
  redirectSignOut: string;
  responseType: string;
}

/**
 * Info: Need to define interface/type for Nest to properly generate OpenAPI model.
 * Ref: https://docs.nestjs.com/openapi/types-and-parameters
 * Example:
 *    interface AuthAwsCognitoConfig{}
 *    class AwsCognitoOauthConfig implements AuthAwsCognitoConfig {}
 *    Usage: @ApiProperty({ type: () => AwsCognitoOauthConfig })
 */
export class AwsCognitoOauthConfig implements AuthAwsCognitoConfig {
  @ApiProperty()
  domain: string;

  @ApiProperty()
  scope: string[];

  @ApiProperty()
  redirectSignIn: string;

  @ApiProperty()
  redirectSignOut: string;

  @ApiProperty()
  responseType: string;
}

@Injectable()
export class AuthService {
    private awsConfig: AwsCognitoConfig;

    private jwksClient;

    constructor(private logger: PinoLogger) {
        this.awsConfig = Object.assign(new AwsCognitoConfig(), aswCognitoEnvJson);
        this.awsConfig.enabled = (process.env.SECURITY_ENABLED || 'true') === 'true';
        console.log(this.awsConfig)
        const jwksUri = `https://cognito-idp.${this.awsConfig.aws_cognito_region}.amazonaws.com/${this.awsConfig.aws_user_pools_id}/.well-known/jwks.json`;
        console.log("jwksUri", jwksUri);
        this.jwksClient = new JwksClient({
            jwksUri,
            cache: true, // Accept cache defaults
            rateLimit: true,
        });
    }

    getAwsCognitoConfig(): AwsCognitoConfig {
        return this.awsConfig;
    }

    async verifyToken(authHeader: string):Promise<User> {
        return this.verifyCognitoToken(authHeader);
    }

    async verifyCognitoToken(authHeader: string):Promise<User> {
        const bearer = 'Bearer ';
        if (!authHeader?.startsWith(bearer) || authHeader.length <= bearer.length) {
            return Promise.reject(new ForbiddenException());
        }
        const tokenStartIndex = bearer.length;
        const token = authHeader.substr(tokenStartIndex);
        if (!this.awsConfig.enabled) {
        const user = User.convertJsonToUser(token);
            return Promise.resolve(user);
        }

        try {
            console.log("Header bearer token (cognitoToken):", token)
            const cognitoToken = JSON.parse(token);
            const cognitoIdToken = cognitoToken['idToken'];
            const cognitoAccessToken = cognitoToken['accessToken'];
            const untrustedDecodedIdToken = decode(cognitoIdToken, { complete: true });
            const untrustedDecodedAccessToken = decode(cognitoAccessToken, { complete: true });
            this.logger.debug("Untrusted decoded ID token %o", untrustedDecodedIdToken);
            this.logger.debug("Untrusted decoded ACCESS token %o", untrustedDecodedAccessToken);

            const idToken_kid = untrustedDecodedIdToken.header.kid;
            const idPubkey = await this.jwksClient.getSigningKey(idToken_kid);
            const decodedIdToken = verify(cognitoIdToken, idPubkey.getPublicKey());
            this.logger.debug("Trusted decoded ID token = %o", decodedIdToken);

            const accessToken_kid = untrustedDecodedAccessToken.header.kid;
            const accessPubkey = await this.jwksClient.getSigningKey(accessToken_kid);
            const decodedAccessToken = verify(cognitoAccessToken, accessPubkey.getPublicKey());
            this.logger.debug("Trusted decoded Access token = %o", decodedAccessToken);

            const decodedToken = {
                decodedIdToken,
                decodedAccessToken
            }
            return User.convertAwsCognitoDecodedTokenToUser(decodedToken);
        } catch (err) {
            this.logger.warn("Invalid token: %o", err);
            return Promise.reject(new ForbiddenException());
        }
    }
}
