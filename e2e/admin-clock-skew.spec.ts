import { test, expect, Page } from '@playwright/test';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';

/**
 * A PC clock an hour off must not turn sign-in into a redirect loop.
 *
 * BC stayed on UTC-7 after November 2026, so a PC with old time zone data (or
 * set to US Pacific) shows the right local time but is an hour ahead in UTC.
 * Its fresh tokens looked issued an hour ago and already expired, so the OIDC
 * client reported "signed out" after every callback and the app sent the
 * browser back to the login, cycling /admin/search?code=...&state=... (#1240)
 *
 * This drives the real sign-in path in the browser: the app redirects to a
 * mocked Keycloak realm, which redirects back with a code; the code is
 * exchanged at a mocked token endpoint for RS256-signed tokens stamped with the
 * test runner's (server) clock. The browser's clock is moved with page.clock.
 *
 * The mock realm lives under gov.bc.ca because the admin CSP's connect-src only
 * allows that domain, as it does for the real loginproxy.gov.bc.ca.
 */

const REALM_HOST = 'e2e-skew.loginproxy.gov.bc.ca';
const ISSUER = `https://${REALM_HOST}/auth/realms/standard`;
const OIDC = `${ISSUER}/protocol/openid-connect`;
const CLIENT_ID = 'fom-e2e-skew-client';
const DISPLAY_NAME = 'E2E Skew Tester';
const KID = 'e2e-skew-kid';
const HOUR_MS = 3600 * 1000;

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const JWK = { ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' };

function b64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signedJwt(payload: Record<string, unknown>): string {
  const input = `${b64url({ alg: 'RS256', kid: KID, typ: 'JWT' })}.${b64url(payload)}`;
  return `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;
}

/** Tokens as the realm issues them, on the server's (test runner's) clock. */
function realmTokens(nonce: string) {
  const now = Math.floor(Date.now() / 1000);
  const common = { sub: 'e2e-skew-sub', iss: ISSUER, iat: now, auth_time: now, azp: CLIENT_ID };
  return {
    id_token: signedJwt({ ...common, exp: now + 300, aud: CLIENT_ID, nonce, typ: 'ID' }),
    // BC Gov SSO puts profile claims and roles on the access token.
    access_token: signedJwt({
      ...common,
      exp: now + 300,
      typ: 'Bearer',
      identity_provider: 'azureidir',
      idir_username: 'E2ESKEW',
      display_name: DISPLAY_NAME,
      client_roles: ['FOM_REVIEWER'],
    }),
    refresh_token: 'e2e-skew-refresh-token',
    expires_in: 300,
    refresh_expires_in: 1800,
    token_type: 'Bearer',
  };
}

interface SignInMocks {
  authorizeCalls: number;
  codeExchanges: number;
  refreshes: number;
}

/** The callback must land on the admin under test, which holds the OIDC state and PKCE verifier. */
async function mockRealm(page: Page, baseURL: string): Promise<SignInMocks> {
  const redirectSignIn = new URL('/admin/search', baseURL).toString();
  const mocks: SignInMocks = { authorizeCalls: 0, codeExchanges: 0, refreshes: 0 };
  let nonce = '';
  let codeChallenge = '';

  await page.route(/\/api\//, (route) => route.fulfill({ json: [] }));
  await page.route(/\/api\/keycloakConfig/, (route) =>
    route.fulfill({ json: { enabled: true, issuerUri: ISSUER, clientId: CLIENT_ID } })
  );

  await page.route(`https://${REALM_HOST}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/.well-known/openid-configuration')) {
      return route.fulfill({
        json: {
          issuer: ISSUER,
          authorization_endpoint: `${OIDC}/auth`,
          token_endpoint: `${OIDC}/token`,
          userinfo_endpoint: `${OIDC}/userinfo`,
          end_session_endpoint: `${OIDC}/logout`,
          jwks_uri: `${OIDC}/certs`,
        },
      });
    }
    if (url.href.startsWith(`${OIDC}/certs`)) {
      return route.fulfill({ json: { keys: [JWK] } });
    }
    if (url.href.startsWith(`${OIDC}/auth`)) {
      // The realm with a live SSO session: straight back with a code.
      mocks.authorizeCalls++;
      nonce = url.searchParams.get('nonce') ?? '';
      codeChallenge = url.searchParams.get('code_challenge') ?? '';
      const back = new URL(redirectSignIn);
      back.searchParams.set('code', `e2e-code-${mocks.authorizeCalls}`);
      back.searchParams.set('state', url.searchParams.get('state') ?? '');
      return route.fulfill({ status: 302, headers: { location: back.toString() } });
    }
    if (url.href.startsWith(`${OIDC}/token`)) {
      const form = new URLSearchParams(route.request().postData() ?? '');
      if (form.get('grant_type') === 'refresh_token') {
        mocks.refreshes++;
        return route.fulfill({ json: realmTokens(nonce) });
      }
      mocks.codeExchanges++;
      const verifier = form.get('code_verifier') ?? '';
      if (createHash('sha256').update(verifier).digest('base64url') !== codeChallenge) {
        return route.fulfill({ status: 400, json: { error: 'invalid_grant' } });
      }
      return route.fulfill({ json: realmTokens(nonce) });
    }
    return route.fulfill({ contentType: 'text/html', body: '<html><body>Mock realm sign-in</body></html>' });
  });

  return mocks;
}

const userName = (page: Page) => page.locator('a[title="Login User"]');

test.describe('Admin - sign-in with the PC clock off by an hour', () => {
  for (const [label, skewMs] of [
    ['on time', 0],
    ['an hour ahead', HOUR_MS],
    ['an hour behind', -HOUR_MS],
  ] as const) {
    test(`signs in once and stays signed in with the clock ${label}`, async ({ page, baseURL }) => {
      if (!baseURL) throw new Error('The admin project must set baseURL.');
      await page.clock.install({ time: Date.now() + skewMs });
      const mocks = await mockRealm(page, baseURL);

      await page.goto('/admin/search');
      await expect(userName(page)).toContainText(DISPLAY_NAME, { timeout: 15000 });
      await expect(page).toHaveURL((url) => url.pathname === '/admin/search' && !url.searchParams.has('code'));

      // The loop came back every ~2 s; give it time to show.
      await page.waitForTimeout(5000);
      expect(mocks.authorizeCalls).toBe(1);
      expect(mocks.codeExchanges).toBe(1);
      expect(mocks.refreshes).toBe(0);
      await expect(userName(page)).toContainText(DISPLAY_NAME);

      // A reload reuses the session: no new sign-in and no refresh.
      await page.reload();
      await expect(userName(page)).toContainText(DISPLAY_NAME, { timeout: 15000 });
      expect(mocks.authorizeCalls).toBe(1);
      expect(mocks.refreshes).toBe(0);
    });
  }
});
