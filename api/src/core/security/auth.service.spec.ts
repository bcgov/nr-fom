import { AuthService } from "@api-core/security/auth.service";
import { mockLoggerFactory } from "../../app/factories/mock-logger.factory";
import { ForbiddenException } from "@nestjs/common";
import { generateKeyPairSync } from "crypto";
import { sign } from "jsonwebtoken";

const ISSUER = 'https://test.loginproxy.gov.bc.ca/auth/realms/standard';
const CLIENT_ID = 'fom-test-1234';

describe('AuthService', () => {
    const savedEnv = { ...process.env };

    const withEnv = (env: Record<string, string | undefined>) => {
        process.env = { ...savedEnv, ...env };
        return new AuthService(mockLoggerFactory());
    };

    afterEach(() => {
        process.env = { ...savedEnv };
    });

    describe('configuration', () => {
        it('serves the issuer and client id when security is enabled', () => {
            const config = withEnv({ SECURITY_ENABLED: 'true', KEYCLOAK_ISSUER_URI: ISSUER + '/', KEYCLOAK_CLIENT_ID: ` ${CLIENT_ID} ` })
                .getKeycloakConfig();
            expect(config).toStrictEqual(expect.objectContaining({ enabled: true, issuerUri: ISSUER, clientId: CLIENT_ID }));
        });

        it('defaults to enabled when SECURITY_ENABLED is unset', () => {
            const config = withEnv({ SECURITY_ENABLED: undefined, KEYCLOAK_ISSUER_URI: ISSUER, KEYCLOAK_CLIENT_ID: CLIENT_ID })
                .getKeycloakConfig();
            expect(config.enabled).toBe(true);
        });

        it.each([
            ['issuer', { KEYCLOAK_ISSUER_URI: '', KEYCLOAK_CLIENT_ID: CLIENT_ID }],
            ['client id', { KEYCLOAK_ISSUER_URI: ISSUER, KEYCLOAK_CLIENT_ID: '  ' }],
        ])('refuses to start enabled without a %s', (_name, env) => {
            expect(() => withEnv({ SECURITY_ENABLED: 'true', ...env })).toThrow(/KEYCLOAK_ISSUER_URI and KEYCLOAK_CLIENT_ID/);
        });

        it('serves neither value when security is disabled', () => {
            const config = withEnv({ SECURITY_ENABLED: 'false', KEYCLOAK_ISSUER_URI: ISSUER, KEYCLOAK_CLIENT_ID: CLIENT_ID })
                .getKeycloakConfig();
            expect(config.enabled).toBe(false);
            expect(config.issuerUri).toBeUndefined();
            expect(config.clientId).toBeUndefined();
        });
    });

    describe('verifyToken with security disabled', () => {
        it('reads the fake user JSON from the bearer', async () => {
            const service = withEnv({ SECURITY_ENABLED: 'false' });
            const user = await service.verifyToken('Bearer ' + JSON.stringify({ userName: 'fake', isMinistry: true }));
            expect(user.userName).toBe('fake');
            expect(user.isMinistry).toBe(true);
        });
    });

    describe('verifyToken with security enabled', () => {
        const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
        const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
        let service: AuthService;

        const claims = (o: object = {}) => ({
            typ: 'Bearer',
            azp: CLIENT_ID,
            identity_provider: 'bceidbusiness',
            bceid_username: 'jdoe',
            display_name: 'J Doe',
            client_roles: ['FOM_SUBMITTER_FOREST_CLIENT-00001011', 'FAM:EXPIRES:2026-09-30:FOM_SUBMITTER_FOREST_CLIENT-00001011'],
            ...o,
        });
        const signToken = (c: object = claims(), opts: object = {}) =>
            'Bearer ' + sign(c, privateKey, { algorithm: 'RS256', keyid: 'k1', issuer: ISSUER, expiresIn: 300, ...opts });

        beforeEach(() => {
            service = withEnv({ SECURITY_ENABLED: 'true', KEYCLOAK_ISSUER_URI: ISSUER, KEYCLOAK_CLIENT_ID: CLIENT_ID });
            (service as any).jwksClient = { getSigningKey: async () => ({ getPublicKey: () => pem }) };
        });

        it('accepts a valid access token and maps the user', async () => {
            const user = await service.verifyToken(signToken());
            expect(user.userName).toBe('jdoe');
            expect(user.displayName).toBe('J Doe');
            expect(user.isForestClient).toBe(true);
            expect(user.clientIds).toStrictEqual(['00001011']);
        });

        it('accepts a token with no token_use claim (Keycloak never sends one)', async () => {
            await expect(service.verifyToken(signToken())).resolves.toBeDefined();
        });

        it('rejects a missing bearer prefix', async () => {
            await expect(service.verifyToken('junk')).rejects.toBeInstanceOf(ForbiddenException);
        });

        it('rejects an empty bearer', async () => {
            await expect(service.verifyToken('Bearer ')).rejects.toBeInstanceOf(ForbiddenException);
        });

        it('rejects a non-JWT bearer, such as the old Cognito JSON pair', async () => {
            await expect(service.verifyToken('Bearer ' + JSON.stringify({ idToken: 'a', accessToken: 'b' })))
                .rejects.toBeInstanceOf(ForbiddenException);
        });

        it('rejects a non-RS256 algorithm', async () => {
            const hs = 'Bearer ' + sign(claims(), pem, { algorithm: 'HS256', keyid: 'k1', issuer: ISSUER });
            await expect(service.verifyToken(hs)).rejects.toBeInstanceOf(ForbiddenException);
        });

        it('rejects a wrong issuer', async () => {
            await expect(service.verifyToken(signToken(claims(), { issuer: 'https://dev.loginproxy.gov.bc.ca/auth/realms/standard' })))
                .rejects.toBeInstanceOf(ForbiddenException);
        });

        it('rejects a token issued to another client on the shared realm', async () => {
            await expect(service.verifyToken(signToken(claims({ azp: 'some-other-app' }))))
                .rejects.toBeInstanceOf(ForbiddenException);
        });

        it('rejects a token with no azp', async () => {
            await expect(service.verifyToken(signToken(claims({ azp: undefined }))))
                .rejects.toBeInstanceOf(ForbiddenException);
        });

        it('rejects an ID token presented as a bearer', async () => {
            await expect(service.verifyToken(signToken(claims({ typ: 'ID' }))))
                .rejects.toBeInstanceOf(ForbiddenException);
        });

        it('rejects an expired token', async () => {
            await expect(service.verifyToken(signToken(claims(), { expiresIn: -10 })))
                .rejects.toBeInstanceOf(ForbiddenException);
        });

        it('rejects a token signed by another key', async () => {
            const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
            const forged = 'Bearer ' + sign(claims(), other, { algorithm: 'RS256', keyid: 'k1', issuer: ISSUER });
            await expect(service.verifyToken(forged)).rejects.toBeInstanceOf(ForbiddenException);
        });

        it('rejects when the signing key cannot be fetched', async () => {
            (service as any).jwksClient = { getSigningKey: async () => { throw new Error('jwks down'); } };
            await expect(service.verifyToken(signToken())).rejects.toBeInstanceOf(ForbiddenException);
        });
    });
});
