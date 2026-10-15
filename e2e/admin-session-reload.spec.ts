import { test, expect, Page } from '@playwright/test';

/**
 * #1206: a signed-in admin session survives a hard reload (#1200, #1201, #1209).
 *
 * No real credentials. The admin app is told Cognito is enabled via a mocked
 * /api/awsCognitoConfig, the angular-auth-oidc-client session is seeded in
 * localStorage (key = configId 'fom-admin'), and every Cognito and API call
 * is answered by page.route, so this works against any admin deployment.
 */

const REGION = 'ca-central-1';
const POOL_ID = `${REGION}_E2Etest`;
const CLIENT_ID = 'e2e-client-id';
const DOMAIN = `fom-e2e.auth.${REGION}.amazoncognito.com`;
const ISSUER = `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}`;
const CONFIG_ID = 'fom-admin';
const DISPLAY_NAME = 'E2E Tester';

const WELL_KNOWN = {
  issuer: ISSUER,
  authorizationEndpoint: `https://${DOMAIN}/oauth2/authorize`,
  tokenEndpoint: `https://${DOMAIN}/oauth2/token`,
  userInfoEndpoint: `https://${DOMAIN}/oauth2/userInfo`,
  endSessionEndpoint: `https://${DOMAIN}/logout`,
  jwksUri: `${ISSUER}/.well-known/jwks.json`,
};

function b64url(value: object | string): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return Buffer.from(text).toString('base64url');
}

/** Structurally valid JWT. The app never verifies the signature. */
function fakeJwt(payload: Record<string, unknown>): string {
  return [b64url({ alg: 'RS256', kid: 'e2e-kid', typ: 'JWT' }), b64url(payload), b64url('e2e-signature')].join('.');
}

function seededSession(expSeconds: number, accessExpSeconds: number = expSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const common = { sub: 'e2e-sub', iss: ISSUER, iat: now - 60, auth_time: now - 60, exp: expSeconds };
  const idToken = fakeJwt({
    ...common,
    aud: CLIENT_ID,
    token_use: 'id',
    'custom:idp_name': 'idir',
    'custom:idp_username': 'E2ETEST',
    'custom:idp_display_name': DISPLAY_NAME,
  });
  const accessToken = fakeJwt({
    ...common,
    exp: accessExpSeconds,
    client_id: CLIENT_ID,
    token_use: 'access',
    'cognito:groups': ['FOM_REVIEWER'],
  });
  return {
    authnResult: { id_token: idToken, access_token: accessToken, refresh_token: 'e2e-refresh-token', token_type: 'Bearer' },
    // The library reads the access token from authzData, the ID and refresh tokens from authnResult.
    authzData: accessToken,
    access_token_expires_at: expSeconds * 1000,
    authWellKnownEndPoints: WELL_KNOWN,
    userData: { sub: 'e2e-sub' },
  };
}

interface Mocks {
  navigations: string[];
  tokenCalls: number;
}

async function mockAuthAndApi(page: Page, session: object, refreshSucceeds: boolean): Promise<Mocks> {
  const mocks: Mocks = { navigations: [], tokenCalls: 0 };
 
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) mocks.navigations.push(frame.url());
  });

  // Seed once: a reload must read what the app itself left in storage.
  await page.addInitScript(([key, value]) => {
    if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value);
  }, [CONFIG_ID, JSON.stringify(session)]);

  // API (any host): permissive defaults, then the Cognito config.
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
          redirectSignIn: 'http://localhost:4200/admin/search',
          redirectSignOut: 'http://localhost:4200/admin/logout',
          responseType: 'code',
        },
        logout: {},
      },
    })
  );

  // Cognito issuer: discovery and keys.
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
  await page.route(`${ISSUER}/.well-known/jwks.json`, (route) => route.fulfill({ json: { keys: [] } }));

  // Hosted UI domain: token/refresh, userinfo, and the sign-in page itself.
  await page.route(`https://${DOMAIN}/**`, (route) => {
    const url = route.request().url();
    if (url.includes('/oauth2/token')) {
      mocks.tokenCalls++;
      return refreshSucceeds
        ? route.fulfill({ json: seededSession(Math.floor(Date.now() / 1000) + 3600).authnResult })
        : route.fulfill({ status: 400, json: { error: 'invalid_grant' } });
    }
    if (url.includes('/oauth2/userInfo')) {
      return route.fulfill({ json: { sub: 'e2e-sub' } });
    }
    return route.fulfill({ contentType: 'text/html', body: '<html><body><h1>Mock hosted UI</h1></body></html>' });
  });

  return mocks;
}

const userName = (page: Page) => page.locator('a[title="Login User"]');
const isLogout = (url: string) => /\/admin\/logout/.test(url);
const isHostedUi = (url: string) => url.includes(DOMAIN);

test.describe('Admin - signed-in session across hard reload (#1206)', () => {
  test('a valid stored session survives a hard reload without signing out', async ({ page }) => {
    const valid = seededSession(Math.floor(Date.now() / 1000) + 3600);
    const mocks = await mockAuthAndApi(page, valid, true);

    await page.goto('/admin/search');
    await expect(userName(page)).toContainText(DISPLAY_NAME, { timeout: 15000 });

    await page.reload();
    await expect(userName(page)).toContainText(DISPLAY_NAME, { timeout: 15000 });
    await expect(page).toHaveURL(/\/admin\/search/);

    expect(mocks.navigations.filter((u) => isLogout(u) || isHostedUi(u))).toEqual([]);
    // #1201: init reuses stored tokens instead of force-refreshing them.
    expect(mocks.tokenCalls).toBe(0);
  });

  test('a restored access token past its exp is refreshed; a failed refresh goes to sign-in, not logout (#1209)', async ({ page }) => {
    const now = Math.floor(Date.now() / 1000);
    // The OIDC library still treats this session as valid (ID token and stored
    // expiry are in the future), but the access JWT itself has expired, which
    // the API rejects with 403. CognitoService.init() must refresh it.
    const stale = seededSession(now + 3600, now - 60);
    const mocks = await mockAuthAndApi(page, stale, false);

    await page.goto('/admin/search');

    await expect(page).toHaveURL((url) => isHostedUi(url.href), { timeout: 15000 });
    expect(new URL(page.url()).pathname).toBe('/oauth2/authorize');
    expect(mocks.tokenCalls).toBeGreaterThanOrEqual(1);
    expect(mocks.navigations.filter(isLogout)).toEqual([]);
  });

  test('a fully expired session goes to sign-in, not logout', async ({ page }) => {
    const expired = seededSession(Math.floor(Date.now() / 1000) - 3600);
    const mocks = await mockAuthAndApi(page, expired, false);

    await page.goto('/admin/search');

    await expect(page).toHaveURL((url) => isHostedUi(url.href), { timeout: 15000 });
    const signIn = new URL(page.url());
    expect(signIn.pathname).toBe('/oauth2/authorize');
    expect(signIn.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(mocks.navigations.filter(isLogout)).toEqual([]);
  });
});
