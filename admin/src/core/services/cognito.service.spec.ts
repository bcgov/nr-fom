import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { CognitoService } from './cognito.service';
import { ConfigService } from '@utility/services/config.service';
import { Amplify } from '@aws-amplify/core';
import { fetchAuthSession, getCurrentUser, signInWithRedirect, signOut } from '@aws-amplify/auth';
import { cognitoUserPoolsTokenProvider } from '@aws-amplify/auth/cognito';

jest.mock('@aws-amplify/core', () => ({
  Amplify: {
    configure: jest.fn()
  },
  defaultStorage: {}
}));

jest.mock('@aws-amplify/auth', () => ({
  getCurrentUser: jest.fn(),
  fetchAuthSession: jest.fn(),
  signInWithRedirect: jest.fn(),
  signOut: jest.fn()
}));

jest.mock('@aws-amplify/auth/cognito', () => ({
  cognitoUserPoolsTokenProvider: {
    setAuthConfig: jest.fn(),
    setKeyValueStorage: jest.fn()
  }
}));

jest.mock('jwt-decode', () => ({
  jwtDecode: jest.fn((token: string) =>
    token === 'mock-id-token'
      ? { sub: '12345', 'custom:idp_name': 'idir' }
      : { sub: '12345' }
  )
}));

describe('CognitoService', () => {
  let service: CognitoService;
  let mockHttpClient: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockHttpClient = {
      get: jest.fn()
    };
    mockConfigService = {
      getApiBasePath: jest.fn().mockReturnValue('http://localhost:3333')
    };

    jest.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        CognitoService,
        { provide: HttpClient, useValue: mockHttpClient },
        { provide: ConfigService, useValue: mockConfigService }
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

  describe('init', () => {
    it('should set initialized to false and return null if on the logout landing path', async () => {
      window.history.pushState({}, '', '/admin/logout');

      const result = await service.init();
      expect(result).toBeNull();
      expect(service.initialized).toBe(false);
      expect(service.loggedOut).toBe(true);
      // The landing must not reach the API: loading config configures Amplify and
      // leads back into the login redirect, undoing the logout.
      expect(mockHttpClient.get).not.toHaveBeenCalled();
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

    it('should load remote config and configure Amplify, and return null if cognito is disabled', async () => {
      window.history.pushState({}, '', '/');
      mockHttpClient.get.mockReturnValue(of({
        enabled: false,
        aws_user_pools_web_client_id: 'client_id',
        aws_user_pools_id: 'pools_id',
        oauth: { domain: 'domain', redirectSignIn: 'signin', redirectSignOut: 'signout' }
      }));

      const result = await service.init();
      expect(result).toBeNull();
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
      expect(cognitoUserPoolsTokenProvider.setAuthConfig).toHaveBeenCalledTimes(1);
      expect(cognitoUserPoolsTokenProvider.setKeyValueStorage).toHaveBeenCalledTimes(1);
      expect(Amplify.configure).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          Auth: {
            tokenProvider: cognitoUserPoolsTokenProvider
          }
        })
      );
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
      expect(Amplify.configure).toHaveBeenCalledTimes(1);
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
      expect(Amplify.configure).not.toHaveBeenCalled();

      // Second try should succeed and call HTTP get again
      const result = await service.init();
      expect(result).toBeNull();
      expect(service.initialized).toBe(true);
      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
      expect(Amplify.configure).toHaveBeenCalledTimes(1);
    });

    it('should bootstrap auth and refresh token when cognito is enabled and user is logged in', async () => {
      window.history.pushState({}, '', '/');
      mockHttpClient.get.mockReturnValue(of({
        enabled: true,
        aws_user_pools_web_client_id: 'client_id',
        aws_user_pools_id: 'pools_id',
        oauth: { domain: 'domain', redirectSignIn: 'signin', redirectSignOut: 'signout' }
      }));
      (getCurrentUser as jest.Mock).mockResolvedValueOnce({ userId: 'user-1' });
      const refreshSpy = jest.spyOn(service, 'refreshToken').mockResolvedValueOnce();

      await service.init();

      expect(getCurrentUser).toHaveBeenCalledTimes(1);
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(service.initialized).toBe(true);
    });

    it('should call login when cognito is enabled and user is not signed in', async () => {
      window.history.pushState({}, '', '/');
      mockHttpClient.get.mockReturnValue(of({
        enabled: true,
        aws_user_pools_web_client_id: 'client_id',
        aws_user_pools_id: 'pools_id',
        oauth: { domain: 'domain', redirectSignIn: 'signin', redirectSignOut: 'signout' }
      }));
      (getCurrentUser as jest.Mock).mockRejectedValueOnce(new Error('Not signed in'));
      let resolveLogin!: () => void;
      const loginCalled = new Promise<void>((resolve) => {
        resolveLogin = resolve;
      });
      const loginSpy = jest.spyOn(service, 'login').mockImplementation(async () => resolveLogin());

      void service.init();
      await loginCalled;

      expect(getCurrentUser).toHaveBeenCalledTimes(1);
      expect(loginSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('login', () => {
    it('should call signInWithRedirect', async () => {
      await service.login();
      expect(signInWithRedirect).toHaveBeenCalledTimes(1);
    });
  });

  describe('refreshToken', () => {
    beforeEach(() => {
      service.awsCognitoConfig = { enabled: true } as any;
    });

    it('should call fetchAuthSession with forceRefresh: true and set cognitoAuthToken on valid tokens', async () => {
      const mockIdToken = 'mock-id-token';
      const mockAccessToken = 'mock-access-token';
      (fetchAuthSession as jest.Mock).mockResolvedValueOnce({
        tokens: {
          idToken: { toString: () => mockIdToken },
          accessToken: { toString: () => mockAccessToken }
        }
      });

      await service.refreshToken();

      expect(fetchAuthSession).toHaveBeenCalledWith({ forceRefresh: true });
      expect(service.getToken()).toEqual({
        decodedIdToken: expect.objectContaining({ sub: '12345', 'custom:idp_name': 'idir' }),
        decodedAccessToken: expect.objectContaining({ sub: '12345' }),
        jwtToken: { idToken: mockIdToken, accessToken: mockAccessToken }
      });
    });

    it('should call fetchAuthSession with forceRefresh: true and trigger logout when tokens are missing', async () => {
      const logoutSpy = jest.spyOn(service, 'logout').mockResolvedValueOnce();
      (fetchAuthSession as jest.Mock).mockResolvedValueOnce({
        tokens: undefined
      });

      await service.refreshToken();

      expect(fetchAuthSession).toHaveBeenCalledWith({ forceRefresh: true });
      expect(logoutSpy).toHaveBeenCalledTimes(1);
    });

    it('should call fetchAuthSession with forceRefresh: true and trigger logout on fetch error', async () => {
      const logoutSpy = jest.spyOn(service, 'logout').mockResolvedValueOnce();
      (fetchAuthSession as jest.Mock).mockRejectedValueOnce(new Error('Auth refresh failed'));

      await service.refreshToken();

      expect(fetchAuthSession).toHaveBeenCalledWith({ forceRefresh: true });
      expect(logoutSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateToken', () => {
    beforeEach(() => {
      service.awsCognitoConfig = { enabled: true } as any;
    });

    it('should call fetchAuthSession with forceRefresh: true and emit next on success', (done) => {
      const mockIdToken = 'mock-id-token';
      const mockAccessToken = 'mock-access-token';
      (fetchAuthSession as jest.Mock).mockResolvedValueOnce({
        tokens: {
          idToken: { toString: () => mockIdToken },
          accessToken: { toString: () => mockAccessToken }
        }
      });

      service.updateToken().subscribe({
        next: (val) => {
          expect(val).toBeUndefined();
          expect(fetchAuthSession).toHaveBeenCalledWith({ forceRefresh: true });
          expect(service.getToken()).toEqual({
            decodedIdToken: expect.objectContaining({ sub: '12345', 'custom:idp_name': 'idir' }),
            decodedAccessToken: expect.objectContaining({ sub: '12345' }),
            jwtToken: { idToken: mockIdToken, accessToken: mockAccessToken }
          });
          done();
        },
        error: () => done.fail('Should not error')
      });
    });

    it('should emit error when fetchAuthSession rejects', (done) => {
      (fetchAuthSession as jest.Mock).mockRejectedValueOnce(new Error('Refresh failed'));

      service.updateToken().subscribe({
        next: () => done.fail('Should not emit next'),
        error: () => {
          expect(fetchAuthSession).toHaveBeenCalledWith({ forceRefresh: true });
          done();
        }
      });
    });
  });

  describe('logout', () => {
    const CLIENT_ID = 'cognito-app-client';
    const CONFIG: any = {
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
    const signedInAs = (idpName?: string, config: any = CONFIG) => {
      service.awsCognitoConfig = config;
      (service as any).cognitoAuthToken = idpName
        ? { decodedIdToken: { 'custom:idp_name': idpName }, decodedAccessToken: {}, jwtToken: {} }
        : undefined;
    };

    beforeEach(() => {
      assignSpy = jest.spyOn(service as any, 'navigateTo').mockImplementation(() => undefined);
      window.localStorage.clear();
    });

    afterEach(() => {
      assignSpy.mockRestore();
      window.localStorage.clear();
    });

    it('navigates the federated chain instead of letting Amplify redirect first', async () => {
      signedInAs('idir');

      await service.logout();

      expect(signOut).not.toHaveBeenCalled();
      expect(assignSpy).toHaveBeenCalledTimes(1);
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

    it('clears this app client\'s Amplify tokens, and only those', async () => {
      window.localStorage.setItem(`CognitoIdentityServiceProvider.${CLIENT_ID}.LastAuthUser`, 'u');
      window.localStorage.setItem(`CognitoIdentityServiceProvider.${CLIENT_ID}.u.idToken`, 'tok');
      window.localStorage.setItem(`CognitoIdentityServiceProvider.${CLIENT_ID}.u.accessToken`, 'tok');
      window.localStorage.setItem('CognitoIdentityServiceProvider.other-app.LastAuthUser', 'keep');
      window.localStorage.setItem('unrelated-key', 'keep');
      signedInAs('idir');

      await service.logout();

      // Every matching key goes, including the ones after the first: deleting inside
      // a localStorage.key(i) walk shifts indices and would leave some behind.
      expect(
        Object.keys(window.localStorage).filter((k) => k.includes(CLIENT_ID))
      ).toEqual([]);
      expect(window.localStorage.getItem('CognitoIdentityServiceProvider.other-app.LastAuthUser')).toBe('keep');
      expect(window.localStorage.getItem('unrelated-key')).toBe('keep');
    });

    it('falls back to a Cognito-only sign-out when the chain is not configured', async () => {
      signedInAs('idir', { ...CONFIG, logout: undefined });

      await service.logout();

      expect(assignSpy).not.toHaveBeenCalled();
      expect(signOut).toHaveBeenCalledTimes(1);
    });

    it('falls back to a Cognito-only sign-out when the session is gone, so the IdP is unknown', async () => {
      // refreshToken() calls logout() after a failed refresh; cognitoAuthToken may
      // already be undefined, leaving no way to pick a Keycloak client.
      signedInAs(undefined);

      await service.logout();

      expect(assignSpy).not.toHaveBeenCalled();
      expect(signOut).toHaveBeenCalledTimes(1);
    });

    it('does nothing but drop the fake user when security is disabled', async () => {
      signedInAs('idir', { ...CONFIG, enabled: false });

      await service.logout();

      expect(assignSpy).not.toHaveBeenCalled();
      expect(signOut).not.toHaveBeenCalled();
      expect(service.getUser()).toBeNull();
    });
  });
});
