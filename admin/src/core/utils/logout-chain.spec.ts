import { buildKeycloakLogoutUrl, buildLogoutChainUrl, siteminderLogoffUrl } from './logout-chain';

const TEST_ISSUER = 'https://test.loginproxy.gov.bc.ca/auth/realms/standard';
const PROD_ISSUER = 'https://loginproxy.gov.bc.ca/auth/realms/standard';
const LANDING = 'https://fom-test.apps.silver.devops.gov.bc.ca/admin/logout';

describe('logout-chain', () => {
  describe('siteminderLogoffUrl', () => {
    it('uses production Siteminder only for the production realm', () => {
      expect(siteminderLogoffUrl(PROD_ISSUER)).toBe('https://logon7.gov.bc.ca/clp-cgi/logoff.cgi');
      expect(siteminderLogoffUrl(TEST_ISSUER)).toBe('https://logontest7.gov.bc.ca/clp-cgi/logoff.cgi');
      expect(siteminderLogoffUrl('https://dev.loginproxy.gov.bc.ca/auth/realms/standard'))
        .toBe('https://logontest7.gov.bc.ca/clp-cgi/logoff.cgi');
      expect(siteminderLogoffUrl('not a url')).toBe('https://logontest7.gov.bc.ca/clp-cgi/logoff.cgi');
    });
  });

  describe('buildKeycloakLogoutUrl', () => {
    it('targets the realm end-session endpoint with client, landing and hint', () => {
      const url = new URL(buildKeycloakLogoutUrl({
        issuerUri: TEST_ISSUER + '/', clientId: 'fom', postLogoutRedirectUri: LANDING, idToken: 'a.b.c',
      }));
      expect(`${url.origin}${url.pathname}`).toBe(`${TEST_ISSUER}/protocol/openid-connect/logout`);
      expect(url.searchParams.get('client_id')).toBe('fom');
      expect(url.searchParams.get('post_logout_redirect_uri')).toBe(LANDING);
      expect(url.searchParams.get('id_token_hint')).toBe('a.b.c');
    });

    it('omits id_token_hint when there is no ID token', () => {
      const url = new URL(buildKeycloakLogoutUrl({ issuerUri: TEST_ISSUER, clientId: 'fom', postLogoutRedirectUri: LANDING }));
      expect(url.searchParams.has('id_token_hint')).toBe(false);
    });
  });

  describe('buildLogoutChainUrl', () => {
    it('wraps the Keycloak URL in Siteminder logoff, encoded exactly once', () => {
      const chain = buildLogoutChainUrl({ issuerUri: TEST_ISSUER, clientId: 'fom', postLogoutRedirectUri: LANDING, idToken: 'a.b.c' })!;
      const outer = new URL(chain);
      expect(`${outer.origin}${outer.pathname}`).toBe('https://logontest7.gov.bc.ca/clp-cgi/logoff.cgi');
      expect(outer.searchParams.get('retnow')).toBe('1');
      // Only two top-level params: the Keycloak URL's own &s must not leak out.
      expect([...outer.searchParams.keys()]).toStrictEqual(['retnow', 'returl']);
      const inner = new URL(outer.searchParams.get('returl')!);
      expect(inner.searchParams.get('post_logout_redirect_uri')).toBe(LANDING);
      expect(inner.searchParams.get('client_id')).toBe('fom');
    });

    it.each([
      ['issuer', { issuerUri: '', clientId: 'fom', postLogoutRedirectUri: LANDING }],
      ['client id', { issuerUri: TEST_ISSUER, clientId: '', postLogoutRedirectUri: LANDING }],
      ['landing', { issuerUri: TEST_ISSUER, clientId: 'fom', postLogoutRedirectUri: '' }],
      ['valid issuer URL', { issuerUri: 'not a url', clientId: 'fom', postLogoutRedirectUri: LANDING }],
    ])('is null without a %s', (_name, config) => {
      expect(buildLogoutChainUrl(config)).toBeNull();
    });
  });
});
