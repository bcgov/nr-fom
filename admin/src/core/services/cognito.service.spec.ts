import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { CognitoService } from './cognito.service';
import { ConfigService } from '@utility/services/config.service';
import { Amplify } from 'aws-amplify';
import { signOut } from 'aws-amplify/auth';

jest.mock('aws-amplify', () => ({
  Amplify: {
    configure: jest.fn()
  }
}));

jest.mock('aws-amplify/auth', () => ({
  getCurrentUser: jest.fn(),
  fetchAuthSession: jest.fn(),
  signInWithRedirect: jest.fn(),
  signOut: jest.fn()
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
      expect(service.initialized).toBe(true);
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
      expect(Amplify.configure).toHaveBeenCalledTimes(1);
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
