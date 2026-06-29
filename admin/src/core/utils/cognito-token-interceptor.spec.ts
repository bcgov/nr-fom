import { TestBed } from '@angular/core/testing';
import { HttpClient, HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { CognitoTokenInterceptor } from './cognito-token-interceptor';
import { CognitoService } from '@admin-core/services/cognito.service';

describe('CognitoTokenInterceptor', () => {
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;
  let mockCognitoService: any;

  beforeEach(() => {
    mockCognitoService = {
      initialized: false,
      getToken: jest.fn().mockReturnValue({ jwtToken: 'mock-jwt' }),
      awsCognitoConfig: { enabled: true },
      updateToken: jest.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        {
          provide: HTTP_INTERCEPTORS,
          useClass: CognitoTokenInterceptor,
          multi: true
        },
        { provide: CognitoService, useValue: mockCognitoService }
      ]
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should not add token if cognitoService is not initialized', () => {
    mockCognitoService.initialized = false;

    httpClient.get('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('should add Authorization header if cognitoService is initialized', () => {
    mockCognitoService.initialized = true;

    httpClient.get('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.get('Authorization')).toBe('Bearer "mock-jwt"');
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
    expect(req2.request.headers.get('Authorization')).toBe('Bearer "mock-jwt"');
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
});
