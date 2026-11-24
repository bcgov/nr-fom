import { test, expect, Page } from '@playwright/test';

/**
 * #1206: a signed-in admin session survives a hard reload (#1200, #1201, #1209).
 *
 * No real credentials. The admin app is told security is enabled via a mocked
 * /api/keycloakConfig, the angular-auth-oidc-client session is seeded in
 * localStorage (key = configId 'fom-admin'), and every realm and API call is
 * answered by page.route, so this works against any admin deployment.
 *
 * The mock realm lives under gov.bc.ca because the admin CSP's connect-src only
 * allows that domain, as it does for the real loginproxy.gov.bc.ca.
 */

const REALM_HOST = 'e2e.loginproxy.gov.bc.ca';
const ISSUER = `https://${REALM_HOST}/auth/realms/standard`;
const OIDC = `${ISSUER}/protocol/openid-connect`;
const CLIENT_ID = 'fom-e2e-client';
const CONFIG_ID = 'fom-admin';
const DISPLAY_NAME = 'E2E Tester';

const WELL_KNOWN = {
  issuer: ISSUER,
  authorizationEndpoint: `${OIDC}/auth`,
  tokenEndpoint: `${OIDC}/token`,
  userInfoEndpoint: `${OIDC}/userinfo`,
  endSessionEndpoint: `${OIDC}/logout`,
  jwksUri: `${OIDC}/certs`,
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
  const common = { sub: 'e2e-sub', iss: ISSUER, iat: now - 60, auth_time: now - 60, exp: expSeconds, azp: CLIENT_ID };
  const idToken = fakeJwt({ ...common, typ: 'ID', aud: CLIENT_ID });
  // BC Gov SSO puts profile claims and roles on the access token.
  const accessToken = fakeJwt({
    ...common,
    exp: accessExpSeconds,
    typ: 'Bearer',
    identity_provider: 'azureidir',
    idir_username: 'E2ETEST',
    display_name: DISPLAY_NAME,
    client_roles: ['FOM_REVIEWER'],
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

  // API (any host): permissive defaults, then the SSO config.
  await page.route(/\/api\//, (route) => route.fulfill({ json: [] }));
  await page.route(/\/api\/keycloakConfig/, (route) =>
    route.fulfill({ json: { enabled: true, issuerUri: ISSUER, clientId: CLIENT_ID } })
  );

  // Realm: discovery, keys, token/refresh, and the sign-in page itself.
  await page.route(`https://${REALM_HOST}/**`, (route) => {
    const url = route.request().url();
    if (url.endsWith('/.well-known/openid-configuration')) {
      return route.fulfill({
        json: {
          issuer: ISSUER,
          authorization_endpoint: WELL_KNOWN.authorizationEndpoint,
          token_endpoint: WELL_KNOWN.tokenEndpoint,
          userinfo_endpoint: WELL_KNOWN.userInfoEndpoint,
          end_session_endpoint: WELL_KNOWN.endSessionEndpoint,
          jwks_uri: WELL_KNOWN.jwksUri,
        },
      });
    }
    if (url.startsWith(WELL_KNOWN.jwksUri)) {
      return route.fulfill({ json: { keys: [] } });
    }
    if (url.startsWith(WELL_KNOWN.tokenEndpoint)) {
      mocks.tokenCalls++;
      return refreshSucceeds
        ? route.fulfill({ json: seededSession(Math.floor(Date.now() / 1000) + 300).authnResult })
        : route.fulfill({ status: 400, json: { error: 'invalid_grant' } });
    }
    return route.fulfill({ contentType: 'text/html', body: '<html><body><h1>Mock realm sign-in</h1></body></html>' });
  });

  return mocks;
}

const userName = (page: Page) => page.locator('a[title="Login User"]');
const isLogout = (url: string) => /\/admin\/logout/.test(url);
const isRealmSignIn = (url: string) => url.startsWith(WELL_KNOWN.authorizationEndpoint);

test.describe('Admin - signed-in session across hard reload (#1206)', () => {
  test('a valid stored session survives a hard reload without signing out', async ({ page }) => {
    const valid = seededSession(Math.floor(Date.now() / 1000) + 3600);
    const mocks = await mockAuthAndApi(page, valid, true);

    await page.goto('/admin/search');
    await expect(userName(page)).toContainText(DISPLAY_NAME, { timeout: 15000 });

    await page.reload();
    await expect(userName(page)).toContainText(DISPLAY_NAME, { timeout: 15000 });
    await expect(page).toHaveURL(/\/admin\/search/);

    expect(mocks.navigations.filter((u) => isLogout(u) || isRealmSignIn(u))).toEqual([]);
    // #1201: init reuses stored tokens instead of force-refreshing them.
    expect(mocks.tokenCalls).toBe(0);
  });

  test('a restored access token past its exp is refreshed; a failed refresh goes to sign-in, not logout (#1209)', async ({ page }) => {
    const now = Math.floor(Date.now() / 1000);
    // The OIDC library still treats this session as valid (ID token and stored
    // expiry are in the future), but the access JWT itself has expired, which
    // the API rejects with 403. KeycloakService.init() must refresh it.
    const stale = seededSession(now + 3600, now - 60);
    const mocks = await mockAuthAndApi(page, stale, false);

    await page.goto('/admin/search');

    await expect(page).toHaveURL((url) => isRealmSignIn(url.href), { timeout: 15000 });
    expect(page.url().startsWith(WELL_KNOWN.authorizationEndpoint)).toBe(true);
    expect(mocks.tokenCalls).toBeGreaterThanOrEqual(1);
    expect(mocks.navigations.filter(isLogout)).toEqual([]);
  });

  test('a stale Cognito session in localStorage is cleared and redirects to Keycloak without issuer mismatch', async ({ page }) => {
    const staleCognito = {
      authWellKnownEndPoints: {
        issuer: 'https://cognito-idp.ca-central-1.amazonaws.com/ca-central-1_UpeAqsYt4',
        authorizationEndpoint: 'https://example.auth.ca-central-1.amazoncognito.com/oauth2/authorize',
        tokenEndpoint: 'https://example.auth.ca-central-1.amazoncognito.com/oauth2/token',
      },
      authzData: 'stale-cognito-token',
    };
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const mocks = await mockAuthAndApi(page, staleCognito, false);

    await page.goto('/admin/search');

    await expect(page).toHaveURL((url) => isRealmSignIn(url.href), { timeout: 15000 });
    expect(errors).toEqual([]);
    expect(mocks.navigations.filter(isLogout)).toEqual([]);
  });

  test('a fully expired session goes to sign-in, not logout', async ({ page }) => {
    const expired = seededSession(Math.floor(Date.now() / 1000) - 3600);
    const mocks = await mockAuthAndApi(page, expired, false);

    await page.goto('/admin/search');

    await expect(page).toHaveURL((url) => isRealmSignIn(url.href), { timeout: 15000 });
    const signIn = new URL(page.url());
    expect(`${signIn.origin}${signIn.pathname}`).toBe(WELL_KNOWN.authorizationEndpoint);
    expect(signIn.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(mocks.navigations.filter(isLogout)).toEqual([]);
  });
});
