import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { cognitoTokenInterceptor, isCognitoOidcRequest } from './cognito-token-interceptor';
import { CognitoService } from '@admin-core/services/cognito.service';

describe('CognitoTokenInterceptor', () => {
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;
  let mockCognitoService: {
    initialized: boolean;
    getToken: jest.Mock;
    awsCognitoConfig: {
      enabled: boolean;
      aws_cognito_region?: string;
      oauth?: { domain: string };
    };
    updateToken: jest.Mock;
  };

  beforeEach(() => {
    mockCognitoService = {
      initialized: false,
      getToken: jest.fn().mockReturnValue({ jwtToken: { idToken: 'mock-id', accessToken: 'mock-access' } }),
      awsCognitoConfig: { enabled: true },
      updateToken: jest.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([cognitoTokenInterceptor])),
        provideHttpClientTesting(),
        { provide: CognitoService, useValue: mockCognitoService }
      ]
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('treats a non-URL and a config without a domain as not a Cognito request', () => {
    const config = {
      enabled: true,
      aws_cognito_region: 'ca-central-1',
      oauth: { domain: 'fam.auth.ca-central-1.amazoncognito.com' },
    } as Parameters<typeof isCognitoOidcRequest>[1];
    expect(isCognitoOidcRequest('not a url', config)).toBe(false);
    expect(isCognitoOidcRequest('https://fam.auth.ca-central-1.amazoncognito.com/oauth2/token', undefined)).toBe(false);
    expect(isCognitoOidcRequest('https://api.example.test/api/foms', config)).toBe(false);
  });

  it('should not add token if cognitoService is not initialized', () => {
    mockCognitoService.initialized = false;

    httpClient.get('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('sends the fake-user JSON when security is disabled', () => {
    mockCognitoService.initialized = true;
    mockCognitoService.awsCognitoConfig = { enabled: false };
    mockCognitoService.getToken.mockReturnValue('{"userName":"fake"}');

    httpClient.get('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.get('Authorization')).toBe('Bearer {"userName":"fake"}');
    req.flush({});
  });

  it('errors when an enabled session has no token', () => {
    mockCognitoService.initialized = true;
    mockCognitoService.getToken.mockReturnValue(undefined);
    let message = '';

    httpClient.get('/api/test').subscribe({
      error: (err: Error) => {
        message = err.message;
      },
    });

    expect(message).toContain('Cognito auth token is missing.');
  });

  it('should add Authorization header if cognitoService is initialized', () => {
    mockCognitoService.initialized = true;

    httpClient.get('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.get('Authorization')).toBe('Bearer ' + JSON.stringify({ idToken: 'mock-id', accessToken: 'mock-access' }));
    req.flush({});
  });

  it('should attempt refresh and retry request on 403 response', () => {
    mockCognitoService.initialized = true;
    mockCognitoService.updateToken.mockReturnValue(of(undefined));

    httpClient.get('/api/test').subscribe();

    // First request should fail with 403
    const req1 = httpMock.expectOne('/api/test');
    req1.flush('forbidden', { status: 403, statusText: 'Forbidden' });

    // CognitoService.updateToken should be called
    expect(mockCognitoService.updateToken).toHaveBeenCalledTimes(1);

    // Second request should be retried
    const req2 = httpMock.expectOne('/api/test');
    expect(req2.request.headers.get('Authorization')).toBe('Bearer ' + JSON.stringify({ idToken: 'mock-id', accessToken: 'mock-access' }));
    req2.flush({ data: 'success' });
  });

  it('should rethrow 403 error if updateToken fails', (done) => {
    mockCognitoService.initialized = true;
    mockCognitoService.updateToken.mockReturnValue(throwError(() => new Error('Refresh failed')));

    httpClient.get('/api/test').subscribe({
      next: () => fail('should have failed'),
      error: (err) => {
        expect(err.status).toBe(403);
        done();
      }
    });

    // First request fails with 403
    const req1 = httpMock.expectOne('/api/test');
    req1.flush('forbidden', { status: 403, statusText: 'Forbidden' });
  });

  it('should propagate other (non-403) errors directly', (done) => {
    mockCognitoService.initialized = true;

    httpClient.get('/api/test').subscribe({
      next: () => fail('should have failed'),
      error: (err) => {
        expect(err.status).toBe(500);
        done();
      }
    });

    const req = httpMock.expectOne('/api/test');
    req.flush('error', { status: 500, statusText: 'Internal Server Error' });
  });

  it('does not attach the API bearer to Cognito OIDC requests', () => {
    mockCognitoService.initialized = true;
    mockCognitoService.awsCognitoConfig = {
      enabled: true,
      aws_cognito_region: 'ca-central-1',
      oauth: { domain: 'fam.auth.ca-central-1.amazoncognito.com' },
    };

    httpClient.get('https://fam.auth.ca-central-1.amazoncognito.com/oauth2/token').subscribe();
    httpClient.get('https://cognito-idp.ca-central-1.amazonaws.com/ca-central-1_pool/.well-known/openid-configuration').subscribe();
    httpClient.get('https://api.example.test/api/foms').subscribe();

    const token = httpMock.expectOne('https://fam.auth.ca-central-1.amazoncognito.com/oauth2/token');
    const discovery = httpMock.expectOne('https://cognito-idp.ca-central-1.amazonaws.com/ca-central-1_pool/.well-known/openid-configuration');
    const api = httpMock.expectOne('https://api.example.test/api/foms');
    expect(token.request.headers.has('Authorization')).toBe(false);
    expect(discovery.request.headers.has('Authorization')).toBe(false);
    expect(api.request.headers.get('Authorization')).toBe(
      'Bearer ' + JSON.stringify({ idToken: 'mock-id', accessToken: 'mock-access' })
    );
    token.flush({});
    discovery.flush({});
    api.flush({});
  });

  it('should propagate new non-403 errors returned from the retried request', (done) => {
    mockCognitoService.initialized = true;
    mockCognitoService.updateToken.mockReturnValue(of(undefined));

    httpClient.get('/api/test').subscribe({
      next: () => fail('should have failed'),
      error: (err) => {
        expect(err.status).toBe(500);
        done();
      }
    });

    // First request fails with 403
    const req1 = httpMock.expectOne('/api/test');
    req1.flush('forbidden', { status: 403, statusText: 'Forbidden' });

    // Retried request fails with 500
    const req2 = httpMock.expectOne('/api/test');
    req2.flush('error', { status: 500, statusText: 'Internal Server Error' });
  });
});
