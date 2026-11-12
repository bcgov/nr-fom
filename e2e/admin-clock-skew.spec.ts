import { test, expect, Page } from '@playwright/test';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';

/**
 * A PC clock an hour off must not turn sign-in into a redirect loop.
 *
 * BC stayed on UTC-7 after November 2026, so a PC with old time zone data (or
 * set to US Pacific) shows the right local time but is an hour ahead in UTC.
 * Its fresh Cognito tokens looked issued an hour ago and already expired, so
 * the OIDC client reported "signed out" after every callback and the app sent
 * the browser back to the hosted UI, cycling /admin/search?code=...&state=...
 *
 * This drives the real sign-in path in the browser: the app redirects to a
 * mocked hosted UI, which redirects back with a code; the code is exchanged at
 * a mocked token endpoint for RS256-signed tokens stamped with the test
 * runner's (server) clock. The browser's clock is moved with page.clock.
 */

const REGION = 'ca-central-1';
const POOL_ID = `${REGION}_E2Eskew`;
const CLIENT_ID = 'e2e-skew-client-id';
const DOMAIN = `fom-e2e-skew.auth.${REGION}.amazoncognito.com`;
const ISSUER = `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}`;
const REDIRECT_SIGN_IN = 'http://localhost:4200/admin/search';
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

/** Tokens as Cognito issues them, on the server's (test runner's) clock. */
function cognitoTokens(nonce: string) {
  const now = Math.floor(Date.now() / 1000);
  const common = { sub: 'e2e-skew-sub', iss: ISSUER, iat: now, auth_time: now };
  return {
    id_token: signedJwt({
      ...common,
      exp: now + 3600,
      aud: CLIENT_ID,
      nonce,
      token_use: 'id',
      'custom:idp_name': 'bceidbusiness',
      'custom:idp_username': 'E2ESKEW',
      'custom:idp_display_name': DISPLAY_NAME,
    }),
    access_token: signedJwt({
      ...common,
      exp: now + 300,
      client_id: CLIENT_ID,
      token_use: 'access',
      'cognito:groups': ['FOM_REVIEWER'],
    }),
    refresh_token: 'e2e-skew-refresh-token',
    expires_in: 300,
    token_type: 'Bearer',
  };
}

interface SignInMocks {
  authorizeCalls: number;
  codeExchanges: number;
  refreshes: number;
}

async function mockCognito(page: Page): Promise<SignInMocks> {
  const mocks: SignInMocks = { authorizeCalls: 0, codeExchanges: 0, refreshes: 0 };
  let nonce = '';
  let codeChallenge = '';

  await page.route(/\/api\//, (route) => route.fulfill({ json: [] }));
  await page.route(/\/api\/awsCognitoConfig/, (route) =>
    route.fulfill({
      json: {
        enabled: true,
        aws_cognito_region: REGION,
        aws_user_pools_id: POOL_ID,
        aws_user_pools_web_client_id: CLIENT_ID,
        oauth: {
          domain: DOMAIN,
          scope: ['openid'],
          redirectSignIn: REDIRECT_SIGN_IN,
          redirectSignOut: 'http://localhost:4200/admin/logout',
          responseType: 'code',
        },
        logout: {},
      },
    })
  );
  await page.route(`${ISSUER}/.well-known/openid-configuration`, (route) =>
    route.fulfill({
      json: {
        issuer: ISSUER,
        authorization_endpoint: `https://${DOMAIN}/oauth2/authorize`,
        token_endpoint: `https://${DOMAIN}/oauth2/token`,
        userinfo_endpoint: `https://${DOMAIN}/oauth2/userInfo`,
        end_session_endpoint: `https://${DOMAIN}/logout`,
        jwks_uri: `${ISSUER}/.well-known/jwks.json`,
      },
    })
  );
  await page.route(`${ISSUER}/.well-known/jwks.json`, (route) => route.fulfill({ json: { keys: [JWK] } }));

  await page.route(`https://${DOMAIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/oauth2/authorize') {
      // The hosted UI with a live IdP session: straight back with a code.
      mocks.authorizeCalls++;
      nonce = url.searchParams.get('nonce') ?? '';
      codeChallenge = url.searchParams.get('code_challenge') ?? '';
      const back = new URL(REDIRECT_SIGN_IN);
      back.searchParams.set('code', `e2e-code-${mocks.authorizeCalls}`);
      back.searchParams.set('state', url.searchParams.get('state') ?? '');
      return route.fulfill({ status: 302, headers: { location: back.toString() } });
    }
    if (url.pathname === '/oauth2/token') {
      const form = new URLSearchParams(route.request().postData() ?? '');
      if (form.get('grant_type') === 'refresh_token') {
        mocks.refreshes++;
        return route.fulfill({ json: cognitoTokens(nonce) });
      }
      mocks.codeExchanges++;
      const verifier = form.get('code_verifier') ?? '';
      if (createHash('sha256').update(verifier).digest('base64url') !== codeChallenge) {
        return route.fulfill({ status: 400, json: { error: 'invalid_grant' } });
      }
      return route.fulfill({ json: cognitoTokens(nonce) });
    }
    return route.fulfill({ contentType: 'text/html', body: '<html><body>Mock hosted UI</body></html>' });
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
    test(`signs in once and stays signed in with the clock ${label}`, async ({ page }) => {
      await page.clock.install({ time: Date.now() + skewMs });
      const mocks = await mockCognito(page);

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
