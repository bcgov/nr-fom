import { buildFederatedLogoutUrl, FederatedLogoutConfig } from './logout-chain';

const CONFIG: FederatedLogoutConfig = {
  siteminderLogoutUrl: 'https://logontest7.gov.bc.ca/clp-cgi/logoff.cgi',
  keycloakLogoutUrl:
    'https://dev.loginproxy.gov.bc.ca/auth/realms/standard/protocol/openid-connect/logout',
  keycloakClientIdIdir: 'fsa-cognito-idir-dev-4088',
  keycloakClientIdBceidBusiness: 'fsa-cognito-b-ce-id-business-dev-4090',
  cognitoDomain: 'lza-prod-fam-user-pool-domain.auth.ca-central-1.amazoncognito.com',
  cognitoClientId: '1iai0av52nvnjn7olurbi8unl0',
  appReturnUrl: 'http://localhost:4200/admin/logout'
};

/**
 * Peels the chain apart the way the browser does: read a query param, decode it
 * ONCE, parse the result as a URL. If any layer were double- or un-encoded this
 * would throw or yield the wrong host, which is the whole point of the exercise.
 */
const unwrap = (url: string, param: string): URL =>
  new URL(new URL(url).searchParams.get(param)!);

describe('buildFederatedLogoutUrl', () => {
  describe('IdP selection', () => {
    it('uses the IDIR client id for an IDIR login, and not the BCeID one', () => {
      const keycloak = unwrap(buildFederatedLogoutUrl(CONFIG, 'idir')!, 'returl');

      expect(keycloak.searchParams.get('client_id')).toBe(CONFIG.keycloakClientIdIdir);
      expect(keycloak.searchParams.get('client_id')).not.toBe(
        CONFIG.keycloakClientIdBceidBusiness
      );
    });

    it('uses the BCeID Business client id for a BCeID Business login', () => {
      const keycloak = unwrap(buildFederatedLogoutUrl(CONFIG, 'bceidbusiness')!, 'returl');

      expect(keycloak.searchParams.get('client_id')).toBe(
        CONFIG.keycloakClientIdBceidBusiness
      );
    });

    // The claim carries the bare IdP name today, but the Cognito identity providers
    // are named DEV-IDIR / TEST-IDIR / PROD-IDIR. Matching tolerates both so a FAM
    // attribute-mapping change cannot silently drop every logout to the fallback.
    it.each([
      ['idir', CONFIG.keycloakClientIdIdir],
      ['IDIR', CONFIG.keycloakClientIdIdir],
      ['DEV-IDIR', CONFIG.keycloakClientIdIdir],
      ['PROD-IDIR', CONFIG.keycloakClientIdIdir],
      ['bceidbusiness', CONFIG.keycloakClientIdBceidBusiness],
      ['BCEIDBUSINESS', CONFIG.keycloakClientIdBceidBusiness],
      ['TEST-BCEIDBUSINESS', CONFIG.keycloakClientIdBceidBusiness]
    ])('resolves %s to the right Keycloak client', (idp, expected) => {
      const keycloak = unwrap(buildFederatedLogoutUrl(CONFIG, idp)!, 'returl');

      expect(keycloak.searchParams.get('client_id')).toBe(expected);
    });

    it.each([undefined, '', 'bceidbasic', 'github'])(
      'returns null for an unusable idpProvider (%s)',
      (idp) => {
        expect(buildFederatedLogoutUrl(CONFIG, idp)).toBeNull();
      }
    );
  });

  describe('incomplete configuration', () => {
    it.each([
      'siteminderLogoutUrl',
      'keycloakLogoutUrl',
      'keycloakClientIdIdir',
      'cognitoDomain',
      'cognitoClientId',
      'appReturnUrl'
    ] as (keyof FederatedLogoutConfig)[])('returns null when %s is blank', (field) => {
      expect(buildFederatedLogoutUrl({ ...CONFIG, [field]: '' }, 'idir')).toBeNull();
    });

    it('returns null when the BCeID client id is blank and the user is BCeID', () => {
      expect(
        buildFederatedLogoutUrl(
          { ...CONFIG, keycloakClientIdBceidBusiness: '' },
          'bceidbusiness'
        )
      ).toBeNull();
    });

    it('still builds for an IDIR user when only the BCeID client id is blank', () => {
      expect(
        buildFederatedLogoutUrl({ ...CONFIG, keycloakClientIdBceidBusiness: '' }, 'idir')
      ).not.toBeNull();
    });
  });

  describe('chain structure', () => {
    it('hands the browser to Siteminder first, skipping its interstitial', () => {
      const url = buildFederatedLogoutUrl(CONFIG, 'idir')!;

      expect(url.startsWith(`${CONFIG.siteminderLogoutUrl}?retnow=1&returl=`)).toBe(true);
    });

    it('nests Siteminder -> Keycloak -> Cognito -> app, each encoded exactly once', () => {
      const url = buildFederatedLogoutUrl(CONFIG, 'idir')!;

      // Layer 1: Siteminder's returl decodes once to the Keycloak end-session URL.
      const keycloak = unwrap(url, 'returl');
      expect(keycloak.origin + keycloak.pathname).toBe(CONFIG.keycloakLogoutUrl);

      // Layer 2: its post_logout_redirect_uri decodes once to the Cognito logout URL.
      const cognito = unwrap(keycloak.href, 'post_logout_redirect_uri');
      expect(cognito.origin + cognito.pathname).toBe(`https://${CONFIG.cognitoDomain}/logout`);
      expect(cognito.searchParams.get('client_id')).toBe(CONFIG.cognitoClientId);

      // Layer 3: its logout_uri decodes once to exactly the app return URL. Single
      // encoding is the entire correctness argument of this chain, so it is asserted
      // structurally rather than by matching an encoded fragment.
      expect(cognito.searchParams.get('logout_uri')).toBe(CONFIG.appReturnUrl);
    });

    it('encodes the inner query separators so the outer hop cannot swallow them', () => {
      const url = buildFederatedLogoutUrl(CONFIG, 'idir')!;

      // Exactly one '?' outside the encoded payload: Siteminder's own.
      expect(url.split('?').length - 1).toBe(1);
      // The inner URLs' separators survive as %3F / %26 rather than being parsed
      // as Siteminder's own parameters.
      expect(url).toContain('%3F');
      expect(url).toContain('%26');
    });
  });
});
