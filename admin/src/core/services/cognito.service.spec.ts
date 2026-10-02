import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AwsCognitoConfig } from '@api-client';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { CognitoAuthToken, CognitoService, StagedOidcConfig, StagedOidcConfigLoader } from './cognito.service';
import { ConfigService } from '@utility/services/config.service';

const ENABLED_CONFIG = {
  enabled: true,
  aws_cognito_region: 'ca-central-1',
  aws_user_pools_web_client_id: 'client_id',
  aws_user_pools_id: 'pools_id',
  oauth: {
    domain: 'domain.auth.ca-central-1.amazoncognito.com',
    scope: ['openid'],
    redirectSignIn: 'https://app.example/admin/search',
    redirectSignOut: 'https://app.example/admin/logout',
    responseType: 'code',
  },
};

describe('CognitoService', () => {
  let service: CognitoService;
  let mockHttpClient: { get: jest.Mock };
  let mockConfigService: { getApiBasePath: jest.Mock };
  let oidc: {
    checkAuth: jest.Mock;
    authorize: jest.Mock;
    forceRefreshSession: jest.Mock;
    getPayloadFromIdToken: jest.Mock;
    getPayloadFromAccessToken: jest.Mock;
    logoffLocal: jest.Mock;
  };

  beforeEach(() => {
    mockHttpClient = {
      get: jest.fn()
    };
    mockConfigService = {
      getApiBasePath: jest.fn().mockReturnValue('http://localhost:3333')
    };
    oidc = {
      checkAuth: jest.fn(),
      authorize: jest.fn(),
      forceRefreshSession: jest.fn(),
      getPayloadFromIdToken: jest.fn(),
      getPayloadFromAccessToken: jest.fn(),
      logoffLocal: jest.fn(),
    };

    jest.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        CognitoService,
        StagedOidcConfigLoader,
        { provide: HttpClient, useValue: mockHttpClient },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: OidcSecurityService, useValue: oidc },
      ]
    });
    service = TestBed.inject(CognitoService);
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

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
      TestBed.inject(StagedOidcConfig).config = { authority: 'https://issuer.example', clientId: 'c' };
      TestBed.inject(StagedOidcConfigLoader).loadConfigs().subscribe({
        next: (configs) => {
          expect(configs).toEqual([{ authority: 'https://issuer.example', clientId: 'c' }]);
          done();
        },
        error: () => done.fail('should not error')
      });
    });
  });

  describe('init', () => {
    it('should set initialized to false and return null if on the logout landing path', async () => {
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

    // The regression that matters: an over-broad isLogoutLanding() would silently
    // disable authentication everywhere, since init() is the only thing that
    // bootstraps it.
    it.each(['/admin/search', '/admin', '/admin/a/123', '/admin/logout-history'])(
      'should NOT early-return on a normal path (%s)',
      async (path) => {
        window.history.pushState({}, '', path);
        mockHttpClient.get.mockReturnValue(of({
          enabled: false,
          aws_user_pools_web_client_id: 'client_id',
          aws_user_pools_id: 'pools_id',
          oauth: { domain: 'domain', redirectSignIn: 'signin', redirectSignOut: 'signout' }
        }));

        await service.init();

        expect(service.loggedOut).toBe(false);
        expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
      }
    );

    it('should treat a trailing slash on the logout path as the landing', async () => {
      window.history.pushState({}, '', '/admin/logout/');

      await service.init();

      expect(service.loggedOut).toBe(true);
    });

    it('should load remote config and return without starting OIDC when cognito is disabled', async () => {
      window.history.pushState({}, '', '/');
      mockHttpClient.get.mockReturnValue(of({
        enabled: false,
        aws_user_pools_web_client_id: 'client_id',
        aws_user_pools_id: 'pools_id',
        oauth: { domain: 'domain', redirectSignIn: 'signin', redirectSignOut: 'signout' }
      }));

      const result = await service.init();
      expect(result).toBeUndefined();
      expect(service.initialized).toBe(true);
      expect(service.getUser()?.userName).toBe('fakeAllAccessUser');
      expect(service.getToken()).toContain('fakeAllAccessUser');
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
      expect(oidc.checkAuth).not.toHaveBeenCalled();
      expect(TestBed.inject(StagedOidcConfig).config).toBeNull();

      await service.init();
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
    });

    it('should call loadRemoteConfig exactly once even if concurrent calls are made', async () => {
      window.history.pushState({}, '', '/');
      mockHttpClient.get.mockReturnValue(of({
        enabled: false,
        aws_user_pools_web_client_id: 'client_id',
        aws_user_pools_id: 'pools_id',
        oauth: { domain: 'domain', redirectSignIn: 'signin', redirectSignOut: 'signout' }
      }));

      const p1 = service.init();
      const p2 = service.init();

      await Promise.all([p1, p2]);

      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
      expect(oidc.checkAuth).not.toHaveBeenCalled();
    });

    it('should retry loadRemoteConfig if the first call failed', async () => {
      window.history.pushState({}, '', '/');
      mockHttpClient.get.mockReturnValueOnce(throwError(() => new Error('API down')));
      mockHttpClient.get.mockReturnValueOnce(of({
        enabled: false,
        aws_user_pools_web_client_id: 'client_id',
        aws_user_pools_id: 'pools_id',
        oauth: { domain: 'domain', redirectSignIn: 'signin', redirectSignOut: 'signout' }
      }));

      await expect(service.init()).rejects.toThrow('API down');
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
      expect(oidc.checkAuth).not.toHaveBeenCalled();

      const result = await service.init();
      expect(result).toBeUndefined();
      expect(service.initialized).toBe(true);
      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
      expect(oidc.checkAuth).not.toHaveBeenCalled();
    });

    it('rejects an enabled config that cannot build an OIDC client', async () => {
      window.history.pushState({}, '', '/');
      mockHttpClient.get.mockReturnValue(of({
        enabled: true,
        aws_user_pools_web_client_id: 'client_id',
        aws_user_pools_id: 'pools_id',
        oauth: { domain: 'domain', redirectSignIn: 'signin', redirectSignOut: 'signout' }
      }));

      await expect(service.init()).rejects.toThrow('Cognito OIDC config is incomplete.');
      expect(oidc.checkAuth).not.toHaveBeenCalled();
    });

    it('should stage the Cognito issuer and refresh when the user is already signed in', async () => {
      window.history.pushState({}, '', '/');
      mockHttpClient.get.mockReturnValue(of(ENABLED_CONFIG));
      oidc.checkAuth.mockImplementation(() => {
        const staged = TestBed.inject(StagedOidcConfig).config;
        expect(staged).toEqual({
          configId: 'fom-admin',
          authority: 'https://cognito-idp.ca-central-1.amazonaws.com/pools_id',
          clientId: 'client_id',
          redirectUrl: 'https://app.example/admin/search',
          postLogoutRedirectUri: 'https://app.example/admin/logout',
          responseType: 'code',
          scope: 'openid',
          silentRenew: true,
          useRefreshToken: true,
          disableRefreshTokenOfflineAccessScopeWarning: true,
          allowUnsafeReuseRefreshToken: true,
          autoUserInfo: false,
          renewUserInfoAfterTokenRenew: false,
          triggerAuthorizationResultEvent: true,
        });
        expect(staged?.customParamsAuthRequest).toBeUndefined();
        return of({ isAuthenticated: true });
      });
      const refreshSpy = jest.spyOn(service, 'refreshToken').mockResolvedValueOnce();

      await service.init();

      expect(oidc.checkAuth).toHaveBeenCalledTimes(1);
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(service.initialized).toBe(true);
    });

    it('should call login when cognito is enabled and user is not signed in', async () => {
      window.history.pushState({}, '', '/');
      mockHttpClient.get.mockReturnValue(of(ENABLED_CONFIG));
      oidc.checkAuth.mockReturnValue(of({ isAuthenticated: false, errorMessage: 'Not signed in' }));
      let resolveLogin!: () => void;
      const loginCalled = new Promise<void>((resolve) => {
        resolveLogin = resolve;
      });
      const loginSpy = jest.spyOn(service, 'login').mockImplementation(async () => resolveLogin());

      void service.init();
      await loginCalled;

      expect(oidc.checkAuth).toHaveBeenCalledTimes(1);
      expect(loginSpy).toHaveBeenCalledTimes(1);
      expect(oidc.authorize).not.toHaveBeenCalled();
    });

    it('rejects when checkAuth errors, and does not start login', async () => {
      window.history.pushState({}, '', '/');
      mockHttpClient.get.mockReturnValue(of(ENABLED_CONFIG));
      oidc.checkAuth.mockReturnValue(throwError(() => new Error('discovery failed')));
      const loginSpy = jest.spyOn(service, 'login');

      await expect(service.init()).rejects.toThrow('discovery failed');
      expect(loginSpy).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('starts the Cognito hosted UI without an identity_provider', async () => {
      await service.login();
      expect(oidc.authorize).toHaveBeenCalledTimes(1);
      expect(oidc.authorize).toHaveBeenCalledWith();
    });
  });

  describe('refreshToken', () => {
    beforeEach(() => {
      service.awsCognitoConfig = { enabled: true } as unknown as AwsCognitoConfig;
    });

    const session = () => {
      oidc.forceRefreshSession.mockReturnValue(of({
        isAuthenticated: true,
        idToken: 'mock-id-token',
        accessToken: 'mock-access-token',
      }));
      oidc.getPayloadFromIdToken.mockReturnValue(of({ sub: '12345', 'custom:idp_name': 'idir' }));
      oidc.getPayloadFromAccessToken.mockReturnValue(of({ sub: '12345' }));
    };

    it('should refresh the OIDC session and keep both token payloads', async () => {
      session();

      await service.refreshToken();

      expect(oidc.forceRefreshSession).toHaveBeenCalledWith();
      expect(service.getToken()).toEqual({
        decodedIdToken: { sub: '12345', 'custom:idp_name': 'idir' },
        decodedAccessToken: { sub: '12345' },
        jwtToken: { idToken: 'mock-id-token', accessToken: 'mock-access-token' }
      });
    });

    it('should trigger logout when the refresh is not authenticated', async () => {
      const logoutSpy = jest.spyOn(service, 'logout').mockResolvedValueOnce();
      oidc.forceRefreshSession.mockReturnValue(of({ isAuthenticated: false, idToken: '', accessToken: '' }));

      await service.refreshToken();

      expect(logoutSpy).toHaveBeenCalledTimes(1);
    });

    it('should trigger logout when a token payload is missing', async () => {
      const logoutSpy = jest.spyOn(service, 'logout').mockResolvedValueOnce();
      oidc.forceRefreshSession.mockReturnValue(of({
        isAuthenticated: true,
        idToken: 'mock-id-token',
        accessToken: 'mock-access-token',
      }));
      oidc.getPayloadFromIdToken.mockReturnValue(of(null));
      oidc.getPayloadFromAccessToken.mockReturnValue(of({ sub: '12345' }));

      await service.refreshToken();

      expect(logoutSpy).toHaveBeenCalledTimes(1);
    });

    it('should trigger logout on refresh error', async () => {
      const logoutSpy = jest.spyOn(service, 'logout').mockResolvedValueOnce();
      oidc.forceRefreshSession.mockReturnValue(throwError(() => new Error('Auth refresh failed')));

      await service.refreshToken();

      expect(logoutSpy).toHaveBeenCalledTimes(1);
    });

    it('maps the refreshed ID and access tokens onto the user', async () => {
      service.initialized = true;
      oidc.forceRefreshSession.mockReturnValue(of({
        isAuthenticated: true,
        idToken: 'mock-id-token',
        accessToken: 'mock-access-token',
      }));
      oidc.getPayloadFromIdToken.mockReturnValue(of({
        'custom:idp_username': 'JDOE',
        'custom:idp_display_name': 'Doe, Jane',
        'custom:idp_name': 'idir',
      }));
      oidc.getPayloadFromAccessToken.mockReturnValue(of({
        'cognito:groups': ['FOM_REVIEWER'],
      }));

      await service.refreshToken();

      const user = service.getUser();
      expect(user?.userName).toBe('JDOE');
      expect(user?.displayName).toBe('Doe, Jane');
      expect(user?.isMinistry).toBe(true);
      expect(user?.isForestClient).toBe(false);
    });

    it('returns null when initialized but the session has no token', () => {
      service.initialized = true;
      expect(service.getUser()).toBeNull();
    });
  });

  describe('updateToken', () => {
    beforeEach(() => {
      service.awsCognitoConfig = { enabled: true } as unknown as AwsCognitoConfig;
    });

    it('should refresh and emit next on success', (done) => {
      oidc.forceRefreshSession.mockReturnValue(of({
        isAuthenticated: true,
        idToken: 'mock-id-token',
        accessToken: 'mock-access-token',
      }));
      oidc.getPayloadFromIdToken.mockReturnValue(of({ sub: '12345', 'custom:idp_name': 'idir' }));
      oidc.getPayloadFromAccessToken.mockReturnValue(of({ sub: '12345' }));

      service.updateToken().subscribe({
        next: (val) => {
          expect(val).toBeUndefined();
          expect(oidc.forceRefreshSession).toHaveBeenCalledWith();
          expect(service.getToken()).toEqual({
            decodedIdToken: { sub: '12345', 'custom:idp_name': 'idir' },
            decodedAccessToken: { sub: '12345' },
            jwtToken: { idToken: 'mock-id-token', accessToken: 'mock-access-token' }
          });
          done();
        },
        error: () => done.fail('Should not error')
      });
    });

    it('should emit error when the refresh rejects', (done) => {
      oidc.forceRefreshSession.mockReturnValue(throwError(() => new Error('Refresh failed')));

      service.updateToken().subscribe({
        next: () => done.fail('Should not emit next'),
        error: () => {
          expect(oidc.forceRefreshSession).toHaveBeenCalledWith();
          done();
        }
      });
    });
  });

  describe('logout', () => {
    const CLIENT_ID = 'cognito-app-client';
    const CONFIG = {
      enabled: true,
      aws_user_pools_web_client_id: CLIENT_ID,
      aws_user_pools_id: 'pools_id',
      oauth: {
        domain: 'fam.auth.ca-central-1.amazoncognito.com',
        redirectSignIn: 'http://localhost:4200/admin/search',
        redirectSignOut: 'http://localhost:4200/admin/logout'
      },
      logout: {
        siteminderUrl: 'https://logontest7.gov.bc.ca/clp-cgi/logoff.cgi',
        keycloakUrl: 'https://dev.loginproxy.gov.bc.ca/auth/realms/standard/protocol/openid-connect/logout',
        keycloakClientIdIdir: 'kc-client-idir',
        keycloakClientIdBceidBusiness: 'kc-client-bceid'
      }
    };

    // jsdom makes window.location and location.assign both read-only, so the
    // service's navigateTo() seam is what gets stubbed.
    let assignSpy: jest.SpyInstance;

    /** Puts the service in the state a signed-in user's logout starts from. */
    const signedInAs = (idpName?: string, config: AwsCognitoConfig = CONFIG as unknown as AwsCognitoConfig) => {
      service.awsCognitoConfig = config;
      (service as unknown as { cognitoAuthToken?: CognitoAuthToken }).cognitoAuthToken = idpName
        ? {
            decodedIdToken: { 'custom:idp_name': idpName },
            decodedAccessToken: {},
            jwtToken: { idToken: '', accessToken: '' },
          }
        : undefined;
    };

    beforeEach(() => {
      assignSpy = jest.spyOn(
        service as unknown as { navigateTo: (url: string) => void },
        'navigateTo'
      ).mockImplementation(() => undefined);
    });

    afterEach(() => {
      assignSpy.mockRestore();
    });

    it('navigates the federated chain and does not send the browser to Cognito first', async () => {
      signedInAs('idir');

      await service.logout();

      expect(oidc.logoffLocal).toHaveBeenCalledTimes(1);
      expect(assignSpy).toHaveBeenCalledTimes(1);
      expect(oidc.logoffLocal.mock.invocationCallOrder[0]).toBeLessThan(
        assignSpy.mock.invocationCallOrder[0]
      );
      const url: string = assignSpy.mock.calls[0][0];
      expect(url.startsWith(`${CONFIG.logout.siteminderUrl}?retnow=1&returl=`)).toBe(true);

      // Cognito must be the LAST hop, returning to the allow-listed sign-out URL.
      const keycloak = new URL(new URL(url).searchParams.get('returl')!);
      const cognito = new URL(keycloak.searchParams.get('post_logout_redirect_uri')!);
      expect(cognito.host).toBe(CONFIG.oauth.domain);
      expect(cognito.searchParams.get('logout_uri')).toBe(CONFIG.oauth.redirectSignOut);
    });

    it.each([
      ['idir', 'kc-client-idir'],
      ['bceidbusiness', 'kc-client-bceid']
    ])('sends the Keycloak client id matching the %s login', async (idp, expected) => {
      signedInAs(idp);

      await service.logout();

      const keycloak = new URL(new URL(assignSpy.mock.calls[0][0]).searchParams.get('returl')!);
      expect(keycloak.searchParams.get('client_id')).toBe(expected);
    });

    it('falls back to a Cognito-only logout when the chain is not configured', async () => {
      signedInAs('idir', { ...CONFIG, logout: undefined } as unknown as AwsCognitoConfig);

      await service.logout();

      expect(oidc.logoffLocal).toHaveBeenCalledTimes(1);
      expect(assignSpy).toHaveBeenCalledWith(
        'https://fam.auth.ca-central-1.amazoncognito.com/logout' +
        '?client_id=' + CLIENT_ID +
        '&logout_uri=' + encodeURIComponent(CONFIG.oauth.redirectSignOut)
      );
    });

    it('falls back to a Cognito-only logout when the session is gone, so the IdP is unknown', async () => {
      // refreshToken() calls logout() after a failed refresh; cognitoAuthToken may
      // already be undefined, leaving no way to pick a Keycloak client.
      signedInAs(undefined);

      await service.logout();

      expect(assignSpy).toHaveBeenCalledTimes(1);
      expect(String(assignSpy.mock.calls[0][0])).toContain('/logout?client_id=');
      const url = new URL(assignSpy.mock.calls[0][0]);
      expect(url.host).toBe(CONFIG.oauth.domain);
      expect(url.searchParams.get('logout_uri')).toBe(CONFIG.oauth.redirectSignOut);
    });

    it('throws when a Cognito-only logout has no URL, and does not clear the local session first', async () => {
      signedInAs(undefined, { enabled: true } as unknown as AwsCognitoConfig);

      await expect(service.logout()).rejects.toThrow('Cognito logout URL is not configured.');
      expect(oidc.logoffLocal).not.toHaveBeenCalled();
      expect(assignSpy).not.toHaveBeenCalled();
    });

    it('does nothing but drop the fake user when security is disabled', async () => {
      signedInAs('idir', { ...CONFIG, enabled: false } as unknown as AwsCognitoConfig);

      await service.logout();

      expect(assignSpy).not.toHaveBeenCalled();
      expect(oidc.logoffLocal).not.toHaveBeenCalled();
      expect(service.getUser()).toBeNull();
    });
  });
});
