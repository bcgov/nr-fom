import { AuthService } from "@api-core/security/auth.service";
import { mockLoggerFactory } from "../../app/factories/mock-logger.factory";
import aswCognitoEnvJson from '../../assets/aws-cognito-env.json';

describe('AuthService', () => {
    let service: AuthService;

    beforeEach(async () => {
      service = new AuthService(mockLoggerFactory());
    });

    it('Service init succeed with aws config', () => {
        expect(service.getAwsCognitoConfig()).toBeDefined();
        const secEnvEnabled = process.env.SECURITY_ENABLED;
        if (secEnvEnabled != undefined) {
            expect(service.getAwsCognitoConfig().enabled).toBe(secEnvEnabled == 'true')
        }
        else {
            expect(service.getAwsCognitoConfig().enabled).toBe(true)
        }
        expect(service.getAwsCognitoConfig().aws_cognito_domain).toBe(aswCognitoEnvJson.aws_cognito_domain);
        expect(service.getAwsCognitoConfig().aws_cognito_region).toBe(aswCognitoEnvJson.aws_cognito_region);
        expect(service.getAwsCognitoConfig().aws_user_pools_id).toBe(aswCognitoEnvJson.aws_user_pools_id);
        expect(service.getAwsCognitoConfig().aws_user_pools_web_client_id).toBe(aswCognitoEnvJson.aws_user_pools_web_client_id);
        expect(service.getAwsCognitoConfig().oauth).toBe(aswCognitoEnvJson.oauth);
        expect(service.getAwsCognitoConfig().logout).toBe(aswCognitoEnvJson.logout);
    });

    it('Logout chain config is served with every field populated', () => {
        // The admin builds the federated logout chain from these four values and
        // silently falls back to a plain Cognito sign-out if any one is blank, so a
        // missing or empty field here is a broken logout rather than a failed build.
        const logout = service.getAwsCognitoConfig().logout;
        expect(logout.siteminderUrl).toMatch(/^https:\/\/.+\/logoff\.cgi$/);
        expect(logout.keycloakUrl).toMatch(/^https:\/\/.+\/protocol\/openid-connect\/logout$/);
        expect(logout.keycloakClientIdIdir).toBeTruthy();
        expect(logout.keycloakClientIdBceidBusiness).toBeTruthy();
        // The two Keycloak clients are distinct - sending one IdP's client id for the
        // other leaves that IdP's session alive.
        expect(logout.keycloakClientIdIdir).not.toBe(logout.keycloakClientIdBceidBusiness);
    });

    it('Serves the config once, with no "default" copy of itself', () => {
        // A namespace import of the JSON asset compiles to __importStar, which adds a
        // `default` back-reference that Object.assign happily copies - publishing the
        // whole config a second time on this unauthenticated endpoint.
        expect(Object.keys(service.getAwsCognitoConfig())).not.toContain('default');
    });

    it('Sign-out redirect targets the logout landing route, not the old query-param form', () => {
        // Must stay in lockstep with the admin's `/admin/logout` route and with the
        // URL FAM allow-lists as a Cognito sign-out URL.
        expect(service.getAwsCognitoConfig().oauth.redirectSignOut).toMatch(/\/admin\/logout$/);
    });
});
