import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { KeycloakService, StagedOidcConfig, StagedOidcConfigLoader } from './keycloak.service';
import { ConfigService } from '@utility/services/config.service';

const ISSUER = 'https://test.loginproxy.gov.bc.ca/auth/realms/standard';
const CLIENT_ID = 'fom-test-1234';
const ENABLED_CONFIG = { enabled: true, issuerUri: ISSUER, clientId: CLIENT_ID };
const DISABLED_CONFIG = { enabled: false };

const nowSec = () => Math.floor(Date.now() / 1000);

describe('KeycloakService', () => {
  let service: KeycloakService;
  let mockHttpClient: { get: jest.Mock };
  let mockConfigService: { getApiBasePath: jest.Mock };
  let oidc: {
    checkAuth: jest.Mock;
    authorize: jest.Mock;
    forceRefreshSession: jest.Mock;
    getPayloadFromAccessToken: jest.Mock;
    getAccessToken: jest.Mock;
    logoffLocal: jest.Mock;
  };

  beforeEach(() => {
    mockHttpClient = { get: jest.fn() };
    mockConfigService = { getApiBasePath: jest.fn().mockReturnValue('http://localhost:3333') };
    oidc = {
      checkAuth: jest.fn(),
      authorize: jest.fn(),
      forceRefreshSession: jest.fn(),
      getPayloadFromAccessToken: jest.fn(),
      getAccessToken: jest.fn().mockReturnValue(of('')),
      logoffLocal: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        KeycloakService,
        StagedOidcConfigLoader,
        { provide: HttpClient, useValue: mockHttpClient },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: OidcSecurityService, useValue: oidc },
      ]
    });
    service = TestBed.inject(KeycloakService);
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
    window.localStorage.removeItem('fom-admin');
    window.localStorage.removeItem(KeycloakService.CLOCK_OFFSET_KEY);
    jest.restoreAllMocks();
  });

  /** Signed-in init with the given access-token claims. */
  const signIn = async (claims: Record<string, unknown> = { exp: nowSec() + 300, client_roles: ['FOM_REVIEWER'] }) => {
    mockHttpClient.get.mockReturnValue(of(ENABLED_CONFIG));
    oidc.checkAuth.mockReturnValue(of({ isAuthenticated: true, idToken: 'id-1', accessToken: 'access-1' }));
    oidc.getPayloadFromAccessToken.mockReturnValue(of(claims));
    await service.init();
  };

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('StagedOidcConfigLoader', () => {
    it('fails when no OpenID config has been staged', (done) => {
      TestBed.inject(StagedOidcConfigLoader).loadConfigs().subscribe({
        next: () => done.fail('should error'),
        error: (err: Error) => {
          expect(err.message).toBe('OIDC config was not staged');
          done();
        }
      });
    });

    it('returns the staged config', (done) => {
      TestBed.inject(StagedOidcConfig).config = { authority: ISSUER, clientId: 'c' };
      TestBed.inject(StagedOidcConfigLoader).loadConfigs().subscribe({
        next: (configs) => {
          expect(configs).toEqual([{ authority: ISSUER, clientId: 'c' }]);
          done();
        },
        error: () => done.fail('should not error')
      });
    });
  });

  describe('init', () => {
    it('does nothing on the logout landing path', async () => {
      window.history.pushState({}, '', '/admin/logout');

      const result = await service.init();
      expect(result).toBeUndefined();
      expect(service.initialized).toBe(false);
      expect(service.loggedOut).toBe(true);
      // The landing must not reach the API or the OIDC client: either one leads
      // back into the login redirect and undoes the logout.
      expect(mockHttpClient.get).not.toHaveBeenCalled();
      expect(oidc.checkAuth).not.toHaveBeenCalled();
    });

    it.each(['/admin/search', '/admin', '/admin/a/123', '/admin/logout-history'])(
      'does NOT early-return on a normal path (%s)',
      async (path) => {
        window.history.pushState({}, '', path);
        mockHttpClient.get.mockReturnValue(of(DISABLED_CONFIG));

        await service.init();

        expect(service.loggedOut).toBe(false);
        expect(mockHttpClient.get).toHaveBeenCalledWith('http://localhost:3333/api/keycloakConfig', expect.anything());
      }
    );

    it('treats a trailing slash on the logout path as the landing', async () => {
      window.history.pushState({}, '', '/admin/logout/');
      await service.init();
      expect(service.loggedOut).toBe(true);
    });

    it('uses the fake user without starting OIDC when security is disabled', async () => {
      mockHttpClient.get.mockReturnValue(of(DISABLED_CONFIG));

      await service.init();

      expect(service.initialized).toBe(true);
      expect(service.getUser()?.userName).toBe('fakeAllAccessUser');
      await expect(service.getBearerToken()).resolves.toContain('fakeAllAccessUser');
      expect(oidc.checkAuth).not.toHaveBeenCalled();
      expect(TestBed.inject(StagedOidcConfig).config).toBeNull();

      await service.init();
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
    });

    it('loads the remote config once for concurrent calls', async () => {
      mockHttpClient.get.mockReturnValue(of(DISABLED_CONFIG));
      await Promise.all([service.init(), service.init()]);
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
    });

    it('retries the remote config after a failure', async () => {
      mockHttpClient.get.mockReturnValueOnce(throwError(() => new Error('API down')));
      mockHttpClient.get.mockReturnValueOnce(of(DISABLED_CONFIG));

      await expect(service.init()).rejects.toThrow('API down');
      await service.init();

      expect(service.initialized).toBe(true);
      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
    });

    it.each([
      ['issuer', { enabled: true, clientId: CLIENT_ID }],
      ['client id', { enabled: true, issuerUri: ISSUER }],
    ])('rejects an enabled config with no %s', async (_name, config) => {
      mockHttpClient.get.mockReturnValue(of(config));
      await expect(service.init()).rejects.toThrow('Keycloak OIDC config is incomplete.');
      expect(oidc.checkAuth).not.toHaveBeenCalled();
    });

    it('stages the realm as authority and derives redirect URIs from this origin', async () => {
      mockHttpClient.get.mockReturnValue(of({ ...ENABLED_CONFIG, issuerUri: ISSUER + '/' }));
      oidc.checkAuth.mockImplementation(() => {
        expect(TestBed.inject(StagedOidcConfig).config).toEqual({
          configId: 'fom-admin',
          authority: ISSUER,
          clientId: CLIENT_ID,
          redirectUrl: `${window.location.origin}/admin/search`,
          postLogoutRedirectUri: `${window.location.origin}/admin/logout`,
          responseType: 'code',
          scope: 'openid',
          silentRenew: true,
          useRefreshToken: true,
          disableRefreshTokenOfflineAccessScopeWarning: true,
          autoUserInfo: false,
          renewUserInfoAfterTokenRenew: false,
          triggerAuthorizationResultEvent: true,
          disableIdTokenValidation: true,
        });
        return of({ isAuthenticated: true, idToken: 'id', accessToken: 'access' });
      });
      oidc.getPayloadFromAccessToken.mockReturnValue(of({ exp: nowSec() + 300 }));

      await service.init();

      expect(oidc.checkAuth).toHaveBeenCalledTimes(1);
    });

    it('regression (#1200): stored tokens are reused, not force-refreshed', async () => {
      const logoutSpy = jest.spyOn(service, 'logout');

      await signIn();

      expect(oidc.forceRefreshSession).not.toHaveBeenCalled();
      expect(logoutSpy).not.toHaveBeenCalled();
      expect(service.initialized).toBe(true);
      expect(service.getUser()?.isMinistry).toBe(true);
    });

    it('refreshes at startup when the restored access token is already expired', async () => {
      mockHttpClient.get.mockReturnValue(of(ENABLED_CONFIG));
      oidc.checkAuth.mockReturnValue(of({ isAuthenticated: true, idToken: 'old-id', accessToken: 'old-access' }));
      oidc.getPayloadFromAccessToken
        .mockReturnValueOnce(of({ exp: nowSec() - 60 }))
        .mockReturnValueOnce(of({ exp: nowSec() + 300, client_roles: ['FOM_ADMIN'] }));
      oidc.forceRefreshSession.mockReturnValue(of({ isAuthenticated: true, idToken: 'new-id', accessToken: 'new-access' }));

      await service.init();

      expect(oidc.forceRefreshSession).toHaveBeenCalledTimes(1);
      expect(service.initialized).toBe(true);
      expect(service.getUser()?.isAdmin).toBe(true);
      await expect(service.getBearerToken()).resolves.toBe('new-access');
    });

    it('regression (#1209): signs in again, not out, when an expired session cannot be refreshed', async () => {
      mockHttpClient.get.mockReturnValue(of(ENABLED_CONFIG));
      oidc.checkAuth.mockReturnValue(of({ isAuthenticated: true, idToken: 'old-id', accessToken: 'old-access' }));
      oidc.getPayloadFromAccessToken.mockReturnValue(of({ exp: nowSec() - 60 }));
      oidc.forceRefreshSession.mockReturnValue(throwError(() => new Error('refresh rejected')));
      const logoutSpy = jest.spyOn(service, 'logout');

      void service.init();
      await new Promise((r) => setTimeout(r, 0));

      expect(oidc.logoffLocal).toHaveBeenCalledTimes(1);
      expect(oidc.authorize).toHaveBeenCalledTimes(1);
      expect(logoutSpy).not.toHaveBeenCalled();
      expect(service.initialized).toBe(false);
    });

    it('logs out when checkAuth is authenticated but tokens are missing', async () => {
      mockHttpClient.get.mockReturnValue(of(ENABLED_CONFIG));
      oidc.checkAuth.mockReturnValue(of({ isAuthenticated: true, idToken: '', accessToken: '' }));
      const logoutSpy = jest.spyOn(service, 'logout').mockResolvedValueOnce();

      await service.init();

      expect(logoutSpy).toHaveBeenCalledTimes(1);
      expect(service.initialized).toBe(false);
    });

    it('logs out when the access token cannot be decoded', async () => {
      mockHttpClient.get.mockReturnValue(of(ENABLED_CONFIG));
      oidc.checkAuth.mockReturnValue(of({ isAuthenticated: true, idToken: 'id', accessToken: 'access' }));
      oidc.getPayloadFromAccessToken.mockReturnValue(of(null));
      const logoutSpy = jest.spyOn(service, 'logout').mockResolvedValueOnce();

      await service.init();

      expect(logoutSpy).toHaveBeenCalledTimes(1);
      expect(service.initialized).toBe(false);
    });

    it('starts sign-in when not signed in, and never resolves', async () => {
      mockHttpClient.get.mockReturnValue(of(ENABLED_CONFIG));
      oidc.checkAuth.mockReturnValue(of({ isAuthenticated: false, errorMessage: 'Not signed in' }));
      let resolved = false;

      void service.init().then(() => { resolved = true; });
      await new Promise((r) => setTimeout(r, 0));

      expect(oidc.authorize).toHaveBeenCalledTimes(1);
      // No kc_idp_hint: FOM serves IDIR and BCeID Business, so Keycloak offers both.
      expect(oidc.authorize).toHaveBeenCalledWith();
      expect(resolved).toBe(false);
    });

    it('rejects when checkAuth errors, and does not start sign-in', async () => {
      mockHttpClient.get.mockReturnValue(of(ENABLED_CONFIG));
      oidc.checkAuth.mockReturnValue(throwError(() => new Error('discovery failed')));

      await expect(service.init()).rejects.toThrow('discovery failed');
      expect(oidc.authorize).not.toHaveBeenCalled();
    });

    it.each([
      ['Cognito issuer', JSON.stringify({ authWellKnownEndPoints: { issuer: 'https://cognito-idp.ca-central-1.amazonaws.com/ca-central-1_UpeAqsYt4' } })],
      ['different realm issuer', JSON.stringify({ authWellKnownEndPoints: { issuer: 'https://dev.loginproxy.gov.bc.ca/auth/realms/standard' } })],
      ['missing discovery issuer', JSON.stringify({ authzData: 'old-token' })],
      ['corrupt JSON', '{not-json'],
    ])('clears stale OIDC localStorage before checkAuth when cached state has %s', async (_label, cached) => {
      window.localStorage.setItem('fom-admin', cached);
      window.localStorage.setItem(KeycloakService.CLOCK_OFFSET_KEY, '3600000');
      mockHttpClient.get.mockReturnValue(of(ENABLED_CONFIG));
      oidc.checkAuth.mockImplementation(() => {
        expect(window.localStorage.getItem('fom-admin')).toBeNull();
        expect(window.localStorage.getItem(KeycloakService.CLOCK_OFFSET_KEY)).toBeNull();
        return of({ isAuthenticated: true, idToken: 'id', accessToken: 'access' });
      });
      oidc.getPayloadFromAccessToken.mockReturnValue(of({ exp: nowSec() + 300 }));

      await service.init();

      expect(oidc.checkAuth).toHaveBeenCalledTimes(1);
    });

    it('preserves OIDC localStorage when cached discovery issuer matches authority', async () => {
      const cached = JSON.stringify({ authWellKnownEndPoints: { issuer: `${ISSUER}/` }, authzData: 'token-1' });
      window.localStorage.setItem('fom-admin', cached);
      window.localStorage.setItem(KeycloakService.CLOCK_OFFSET_KEY, '500');
      mockHttpClient.get.mockReturnValue(of(ENABLED_CONFIG));
      oidc.checkAuth.mockImplementation(() => {
        expect(window.localStorage.getItem('fom-admin')).toBe(cached);
        expect(window.localStorage.getItem(KeycloakService.CLOCK_OFFSET_KEY)).toBe('500');
        return of({ isAuthenticated: true, idToken: 'id', accessToken: 'access' });
      });
      oidc.getPayloadFromAccessToken.mockReturnValue(of({ exp: nowSec() + 300 }));

      await service.init();

      expect(oidc.checkAuth).toHaveBeenCalledTimes(1);
    });
  });

  describe('isExpired', () => {
    it.each([
      ['past exp', { exp: 100 }, true],
      ['exp equal to now', { exp: 200 }, true],
      ['future exp', { exp: 300 }, false],
      ['no exp claim', {}, false],
    ])('%s', (_name, claims, expected) => {
      expect(KeycloakService.isExpired({ accessToken: 'a', idToken: 'i', claims }, 200_000)).toBe(expected);
    });

    it('is false with no session', () => {
      expect(KeycloakService.isExpired(null)).toBe(false);
    });
  });

  // A PC clock an hour off (BC stayed on UTC-7; old time zone data says UTC-8)
  // must not make fresh tokens look expired or loop back to the login (#1240).
  describe('client clock skew', () => {
    const HOUR_MS = 3600 * 1000;
    const accessClaims = (serverNowSec: number) =>
      ({ sub: '1', iat: serverNowSec, exp: serverNowSec + 300, client_roles: ['FOM_REVIEWER'] });

    describe('isExpired', () => {
      const serverNowMs = 1_800_000_000_000;
      const fresh = { accessToken: 'a', idToken: 'i', claims: accessClaims(serverNowMs / 1000) };

      it.each([
        ['on time', 0],
        ['an hour ahead', HOUR_MS],
        ['an hour behind', -HOUR_MS],
      ])('a fresh token is not expired with the browser clock %s, given its offset', (_label, skew) => {
        expect(KeycloakService.isExpired(fresh, serverNowMs + skew, skew)).toBe(false);
      });

      it('an hour-ahead clock without the offset reads a fresh token as expired', () => {
        expect(KeycloakService.isExpired(fresh, serverNowMs + HOUR_MS)).toBe(true);
      });

      it('an hour-behind clock still sees a token past its exp, given its offset', () => {
        const later = serverNowMs + 301 * 1000;
        expect(KeycloakService.isExpired(fresh, later - HOUR_MS, -HOUR_MS)).toBe(true);
      });
    });

    it.each([
      ['on time', 0],
      ['an hour ahead', HOUR_MS],
      ['an hour behind', -HOUR_MS],
    ])('signs in once on the callback, without a refresh or another redirect, with the browser clock %s', async (_label, skew) => {
      const serverNowMs = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(serverNowMs + skew);
      window.history.pushState({}, '', '/admin/search?code=abc&state=xyz');

      await signIn(accessClaims(Math.floor(serverNowMs / 1000)));

      expect(service.initialized).toBe(true);
      expect(oidc.forceRefreshSession).not.toHaveBeenCalled();
      expect(oidc.authorize).not.toHaveBeenCalled();
      const stored = Number(window.localStorage.getItem(KeycloakService.CLOCK_OFFSET_KEY));
      expect(Math.abs(stored - skew)).toBeLessThan(1000);
    });

    it('a reload of a restored session uses the stored offset instead of refreshing', async () => {
      const serverNowMs = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(serverNowMs + HOUR_MS);
      window.localStorage.setItem(KeycloakService.CLOCK_OFFSET_KEY, String(HOUR_MS));
      window.history.pushState({}, '', '/admin/search');

      await signIn(accessClaims(Math.floor(serverNowMs / 1000) - 60));

      expect(service.initialized).toBe(true);
      expect(oidc.forceRefreshSession).not.toHaveBeenCalled();
    });

    it('ignores a corrupt stored offset', async () => {
      window.localStorage.setItem(KeycloakService.CLOCK_OFFSET_KEY, 'not-a-number');
      window.history.pushState({}, '', '/admin/search');

      await signIn(accessClaims(nowSec()));

      expect(service.initialized).toBe(true);
      expect(oidc.forceRefreshSession).not.toHaveBeenCalled();
    });

    it('a refresh records the offset from the new tokens', async () => {
      await signIn();
      const serverNowMs = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(serverNowMs - HOUR_MS);
      oidc.forceRefreshSession.mockReturnValue(of({ isAuthenticated: true, idToken: 'id', accessToken: 'access' }));
      oidc.getPayloadFromAccessToken.mockReturnValue(of(accessClaims(Math.floor(serverNowMs / 1000))));

      await service.refreshToken();

      const stored = Number(window.localStorage.getItem(KeycloakService.CLOCK_OFFSET_KEY));
      expect(Math.abs(stored + HOUR_MS)).toBeLessThan(1000);
    });
  });

  describe('getUser', () => {
    it('is null before init', () => {
      expect(service.getUser()).toBeNull();
    });

    it('maps forest-client roles from the access token', async () => {
      await signIn({ exp: nowSec() + 300, bceid_username: 'acme', client_roles: ['FOM_SUBMITTER_FOREST_CLIENT-00001011'] });
      const user = service.getUser();
      expect(user?.userName).toBe('acme');
      expect(user?.isForestClient).toBe(true);
      expect(user?.clientIds).toStrictEqual(['00001011']);
    });

    it('is a user with no access when the token carries no roles', async () => {
      await signIn({ exp: nowSec() + 300, idir_username: 'NOBODY' });
      expect(service.getUser()?.isAuthorizedForAdminSite()).toBe(false);
    });
  });

  describe('getBearerToken', () => {
    it('prefers the OIDC client current token, so a silent renew is picked up', async () => {
      await signIn();
      oidc.getAccessToken.mockReturnValue(of('renewed-access'));
      await expect(service.getBearerToken()).resolves.toBe('renewed-access');
    });

    it('falls back to the session token when the OIDC client has none', async () => {
      await signIn();
      oidc.getAccessToken.mockReturnValue(of(''));
      await expect(service.getBearerToken()).resolves.toBe('access-1');
    });

    it('falls back to the session token when reading the OIDC client fails', async () => {
      await signIn();
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      oidc.getAccessToken.mockReturnValue(throwError(() => new Error('no config')));
      await expect(service.getBearerToken()).resolves.toBe('access-1');
    });

    it('is undefined with security disabled and no fake user', async () => {
      mockHttpClient.get.mockReturnValue(of(DISABLED_CONFIG));
      await service.init();
      await service.logout();
      await expect(service.getBearerToken()).resolves.toBeUndefined();
    });
  });

  describe('refreshToken / updateToken', () => {
    it('refreshToken keeps the refreshed session', async () => {
      await signIn();
      oidc.forceRefreshSession.mockReturnValue(of({ isAuthenticated: true, idToken: 'id-2', accessToken: 'access-2' }));
      await service.refreshToken();
      await expect(service.getBearerToken()).resolves.toBe('access-2');
    });

    it('refreshToken logs out when the refresh is not authenticated', async () => {
      await signIn();
      oidc.forceRefreshSession.mockReturnValue(of({ isAuthenticated: false }));
      const logoutSpy = jest.spyOn(service, 'logout').mockResolvedValueOnce();
      await service.refreshToken();
      expect(logoutSpy).toHaveBeenCalledTimes(1);
    });

    it('updateToken emits on success', (done) => {
      oidc.forceRefreshSession.mockReturnValue(of({ isAuthenticated: true, idToken: 'id', accessToken: 'access' }));
      oidc.getPayloadFromAccessToken.mockReturnValue(of({ exp: nowSec() + 300 }));
      service.updateToken().subscribe({ next: () => done(), error: () => done.fail('should not error') });
    });

    it('updateToken errors and signs in again when the refresh rejects', (done) => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      oidc.forceRefreshSession.mockReturnValue(throwError(() => new Error('invalid_grant')));
      service.updateToken().subscribe({
        next: () => done.fail('should not emit'),
        error: () => {
          expect(oidc.logoffLocal).toHaveBeenCalled();
          expect(oidc.authorize).toHaveBeenCalled();
          done();
        }
      });
    });
  });

  describe('logout', () => {
    let assign: jest.SpyInstance;

    beforeEach(() => {
      assign = jest.spyOn(service as any, 'navigateTo').mockImplementation(() => undefined);
    });

    it('chains Siteminder then Keycloak with the id_token_hint, then clears locally', async () => {
      await signIn();

      await service.logout();

      expect(oidc.logoffLocal).toHaveBeenCalledTimes(1);
      const target = new URL(assign.mock.calls[0][0]);
      expect(`${target.origin}${target.pathname}`).toBe('https://logontest7.gov.bc.ca/clp-cgi/logoff.cgi');
      expect(target.searchParams.get('retnow')).toBe('1');
      const keycloak = new URL(target.searchParams.get('returl')!);
      expect(`${keycloak.origin}${keycloak.pathname}`).toBe(`${ISSUER}/protocol/openid-connect/logout`);
      expect(keycloak.searchParams.get('client_id')).toBe(CLIENT_ID);
      expect(keycloak.searchParams.get('id_token_hint')).toBe('id-1');
      expect(keycloak.searchParams.get('post_logout_redirect_uri')).toBe(`${window.location.origin}/admin/logout`);
    });

    it('reads the ID token before clearing the local session', async () => {
      await signIn();
      oidc.logoffLocal.mockImplementation(() => {
        expect(assign).not.toHaveBeenCalled();
      });

      await service.logout();

      const keycloak = new URL(new URL(assign.mock.calls[0][0]).searchParams.get('returl')!);
      expect(keycloak.searchParams.get('id_token_hint')).toBe('id-1');
      expect(service.getUser()).toBeNull();
    });

    it('still ends the realm session without an ID token', async () => {
      mockHttpClient.get.mockReturnValue(of(ENABLED_CONFIG));
      oidc.checkAuth.mockReturnValue(of({ isAuthenticated: true, idToken: '', accessToken: '' }));
      // init() logs out itself here: the session is unusable.
      await service.init();

      const keycloak = new URL(new URL(assign.mock.calls[0][0]).searchParams.get('returl')!);
      expect(keycloak.searchParams.has('id_token_hint')).toBe(false);
      expect(keycloak.searchParams.get('client_id')).toBe(CLIENT_ID);
    });

    it('does nothing but drop the fake user when security is disabled', async () => {
      mockHttpClient.get.mockReturnValue(of(DISABLED_CONFIG));
      await service.init();

      await service.logout();

      expect(service.getUser()).toBeNull();
      expect(oidc.logoffLocal).not.toHaveBeenCalled();
      expect(assign).not.toHaveBeenCalled();
    });
  });
});
