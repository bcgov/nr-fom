import { ForbiddenException, Injectable } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { decode, JwtPayload, verify } from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { PinoLogger } from 'nestjs-pino';

import { User } from '@utility/security/user';

/**
 * What the admin SPA needs to sign in against BC Gov SSO (Keycloak).
 *
 * Served by the API so the SPA authenticates against exactly the realm and client
 * the API validates: both values are stored once (KEYCLOAK_ISSUER_URI,
 * KEYCLOAK_CLIENT_ID on the API) and cannot drift apart. The SPA's redirect URIs
 * are derived from its own origin, and oidc-client discovers every endpoint from
 * the issuer, so nothing else is needed.
 */
export class KeycloakConfig {
  @ApiProperty()
  enabled: boolean = true;

  /** Realm issuer, e.g. https://test.loginproxy.gov.bc.ca/auth/realms/standard. Absent when security is disabled. */
  @ApiPropertyOptional()
  issuerUri?: string;

  /** FOM's CSS integration client id (public client). Absent when security is disabled. */
  @ApiPropertyOptional()
  clientId?: string;
}

@Injectable()
export class AuthService {
    private config: KeycloakConfig;

    private jwksClient: Pick<JwksClient, 'getSigningKey'>;

    constructor(private logger: PinoLogger) {
        this.config = new KeycloakConfig();
        this.config.enabled = (process.env.SECURITY_ENABLED || 'true') === 'true';
        const issuerUri = (process.env.KEYCLOAK_ISSUER_URI || '').trim().replace(/\/+$/, '');
        const clientId = (process.env.KEYCLOAK_CLIENT_ID || '').trim();
        if (this.config.enabled) {
            // Fail fast. A blank client id would make the azp check meaningless: the
            // standard realm is shared by many apps, all signed by the same keys.
            if (!issuerUri || !clientId) {
                throw new Error('KEYCLOAK_ISSUER_URI and KEYCLOAK_CLIENT_ID must be set when SECURITY_ENABLED is true.');
            }
            this.config.issuerUri = issuerUri;
            this.config.clientId = clientId;
        }
        // Keycloak publishes its keys here, not at Cognito's /.well-known/jwks.json.
        this.jwksClient = new JwksClient({
            jwksUri: `${issuerUri}/protocol/openid-connect/certs`,
            cache: true, // Accept cache defaults
            rateLimit: true,
        });
    }

    getKeycloakConfig(): KeycloakConfig {
        return this.config;
    }

    async verifyToken(authHeader: string): Promise<User> {
        const bearer = 'Bearer ';
        if (!authHeader?.startsWith(bearer) || authHeader.length <= bearer.length) {
            return Promise.reject(new ForbiddenException());
        }
        const token = authHeader.substring(bearer.length);
        if (!this.config.enabled) {
            return User.convertJsonToUser(token);
        }

        try {
            const untrusted = decode(token, { complete: true });
            const kid = untrusted?.header?.kid;
            if (!kid) {
                throw new Error('Token has no kid');
            }
            const key = await this.jwksClient.getSigningKey(kid);
            const claims = verify(token, key.getPublicKey(), {
                algorithms: ['RS256'],
                issuer: this.config.issuerUri,
            }) as JwtPayload;
            // Keycloak emits no token_use claim. What proves the token was issued to
            // FOM (rather than to another app on the shared realm) is azp.
            if (claims.azp !== this.config.clientId) {
                throw new Error(`Token was issued to '${claims.azp}', not '${this.config.clientId}'`);
            }
            // An ID token also carries azp; only access tokens are typ Bearer.
            if (claims.typ !== undefined && claims.typ !== 'Bearer') {
                throw new Error(`Unexpected token typ '${claims.typ}'`);
            }
            return User.convertKeycloakClaimsToUser(claims);
        } catch (err) {
            this.logger.warn("Invalid token: %o", err instanceof Error ? err.message : err);
            return Promise.reject(new ForbiddenException());
        }
    }
}
