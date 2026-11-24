import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of, Subject, throwError } from 'rxjs';
import { authTokenInterceptor, isOidcProviderRequest } from './auth-token-interceptor';
import { KeycloakService } from '@admin-core/services/keycloak.service';

const ISSUER = 'https://test.loginproxy.gov.bc.ca/auth/realms/standard';

/** Lets the interceptor's async token read settle before asserting on requests. */
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('authTokenInterceptor', () => {
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;
  let mockKeycloakService: {
    initialized: boolean;
    getBearerToken: jest.Mock;
    keycloakConfig: { enabled: boolean; issuerUri?: string; clientId?: string };
    updateToken: jest.Mock;
  };

  beforeEach(() => {
    mockKeycloakService = {
      initialized: true,
      getBearerToken: jest.fn().mockResolvedValue('access-1'),
      keycloakConfig: { enabled: true, issuerUri: ISSUER, clientId: 'fom' },
      updateToken: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authTokenInterceptor])),
        provideHttpClientTesting(),
        { provide: KeycloakService, useValue: mockKeycloakService }
      ]
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    httpMock.verify();
    jest.restoreAllMocks();
  });

  describe('isOidcProviderRequest', () => {
    it('matches any URL on the realm origin', () => {
      const config = { enabled: true, issuerUri: ISSUER };
      expect(isOidcProviderRequest(`${ISSUER}/protocol/openid-connect/token`, config)).toBe(true);
      expect(isOidcProviderRequest(`${ISSUER}/.well-known/openid-configuration`, config)).toBe(true);
    });

    it('does not match the API, a non-URL, or a missing issuer', () => {
      const config = { enabled: true, issuerUri: ISSUER };
      expect(isOidcProviderRequest('https://fom-test.apps.silver.devops.gov.bc.ca/api/project', config)).toBe(false);
      expect(isOidcProviderRequest('/api/project', config)).toBe(false);
      expect(isOidcProviderRequest(`${ISSUER}/x`, undefined)).toBe(false);
      expect(isOidcProviderRequest(`${ISSUER}/x`, { enabled: false })).toBe(false);
      expect(isOidcProviderRequest(`${ISSUER}/x`, { enabled: true, issuerUri: 'not a url' })).toBe(false);
    });
  });

  it('adds no token before the service is initialized', () => {
    mockKeycloakService.initialized = false;

    httpClient.get('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('never sends the API bearer to the realm', () => {
    httpClient.get(`${ISSUER}/protocol/openid-connect/token`).subscribe();

    const req = httpMock.expectOne(`${ISSUER}/protocol/openid-connect/token`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('sends the raw access token as the bearer', async () => {
    httpClient.get('/api/test').subscribe();
    await settle();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-1');
    req.flush({});
  });

  it('sends the fake-user JSON when security is disabled', async () => {
    mockKeycloakService.keycloakConfig = { enabled: false };
    mockKeycloakService.getBearerToken.mockResolvedValue('{"userName":"fake"}');

    httpClient.get('/api/test').subscribe();
    await settle();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.get('Authorization')).toBe('Bearer {"userName":"fake"}');
    req.flush({});
  });

  it('errors without sending when there is no token', async () => {
    mockKeycloakService.getBearerToken.mockResolvedValue(undefined);
    const error = jest.fn();

    httpClient.get('/api/test').subscribe({ error });
    await settle();

    httpMock.expectNone('/api/test');
    expect(error).toHaveBeenCalledWith(new Error('Auth token is missing.'));
  });

  it('passes non-403 errors through without refreshing', async () => {
    const error = jest.fn();
    httpClient.get('/api/test').subscribe({ error });
    await settle();

    httpMock.expectOne('/api/test').flush({}, { status: 500, statusText: 'Server Error' });

    expect(error).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }));
    expect(mockKeycloakService.updateToken).not.toHaveBeenCalled();
  });

  it('refreshes once on 403 and retries with the new token', async () => {
    mockKeycloakService.updateToken.mockReturnValue(of(undefined));
    mockKeycloakService.getBearerToken
      .mockResolvedValueOnce('stale')
      .mockResolvedValueOnce('fresh');
    const next = jest.fn();

    httpClient.get('/api/test').subscribe(next);
    await settle();
    httpMock.expectOne('/api/test').flush({}, { status: 403, statusText: 'Forbidden' });
    await settle();

    const retry = httpMock.expectOne('/api/test');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer fresh');
    retry.flush({ ok: true });
    expect(next).toHaveBeenCalledWith({ ok: true });
    expect(mockKeycloakService.updateToken).toHaveBeenCalledTimes(1);
  });

  it('rethrows the original 403 when the refresh fails', async () => {
    mockKeycloakService.updateToken.mockReturnValue(throwError(() => new Error('invalid_grant')));
    const error = jest.fn();

    httpClient.get('/api/test').subscribe({ error });
    await settle();
    httpMock.expectOne('/api/test').flush({}, { status: 403, statusText: 'Forbidden' });

    expect(error).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it('propagates an error from the retried request', async () => {
    mockKeycloakService.updateToken.mockReturnValue(of(undefined));
    const error = jest.fn();

    httpClient.get('/api/test').subscribe({ error });
    await settle();
    httpMock.expectOne('/api/test').flush({}, { status: 403, statusText: 'Forbidden' });
    await settle();
    httpMock.expectOne('/api/test').flush({}, { status: 403, statusText: 'Forbidden' });

    expect(error).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
    expect(mockKeycloakService.updateToken).toHaveBeenCalledTimes(1);
  });

  it('shares one refresh between concurrent 403s, and resets after a failure', async () => {
    const refresh$ = new Subject<void>();
    mockKeycloakService.updateToken.mockReturnValue(refresh$);

    httpClient.get('/api/a').subscribe({ error: () => undefined });
    httpClient.get('/api/b').subscribe({ error: () => undefined });
    await settle();
    httpMock.expectOne('/api/a').flush({}, { status: 403, statusText: 'Forbidden' });
    httpMock.expectOne('/api/b').flush({}, { status: 403, statusText: 'Forbidden' });
    expect(mockKeycloakService.updateToken).toHaveBeenCalledTimes(1);

    refresh$.next();
    refresh$.complete();
    await settle();
    httpMock.expectOne('/api/a').flush({});
    httpMock.expectOne('/api/b').flush({});

    // A later 403 starts a new refresh rather than waiting on the finished one.
    mockKeycloakService.updateToken.mockReturnValue(throwError(() => new Error('x')));
    httpClient.get('/api/c').subscribe({ error: () => undefined });
    await settle();
    httpMock.expectOne('/api/c').flush({}, { status: 403, statusText: 'Forbidden' });
    expect(mockKeycloakService.updateToken).toHaveBeenCalledTimes(2);
  });
});
