import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { CognitoService } from './cognito.service';
import { ConfigService } from '@utility/services/config.service';

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
    it('should set initialized to false and return null if loggedout query param is true', async () => {
      window.history.pushState({}, '', '/?loggedout=true');

      const result = await service.init();
      expect(result).toBeNull();
      expect(service.initialized).toBe(false);
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

      // Second try should succeed and call HTTP get again
      const result = await service.init();
      expect(result).toBeNull();
      expect(service.initialized).toBe(true);
      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
    });
  });
});
