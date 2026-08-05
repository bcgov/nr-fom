import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LoadingService } from '@public-core/services/loading.service';
import { ModalService } from '@public-core/services/modal.service';
import { errorInterceptor } from './http-error.interceptor';

describe('errorInterceptor — global loading signal', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let loadingSvc: LoadingService;
  let mockModalService: Partial<ModalService>;

  beforeEach(() => {
    mockModalService = { openDialog: jest.fn() };
    // Silence the interceptor's console.error on failure so test output stays clean.
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: ModalService, useValue: mockModalService },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    loadingSvc = TestBed.inject(LoadingService);
  });

  afterEach(() => {
    httpMock.verify();
    jest.restoreAllMocks();
  });

  it('starts not loading', () => {
    expect(loadingSvc.loading()).toBe(false);
  });

  it('is loading while a request is in flight and settles to false on success', () => {
    httpClient.get('/api/ok').subscribe();

    expect(loadingSvc.loading()).toBe(true);

    httpMock.expectOne('/api/ok').flush({ data: 'ok' });

    expect(loadingSvc.loading()).toBe(false);
  });

  it('settles loading to false when the request FAILS', (done) => {
    httpClient.get('/api/boom').subscribe({
      next: () => done.fail('request should have errored'),
      error: () => {
        expect(loadingSvc.loading()).toBe(false);
        done();
      },
    });

    expect(loadingSvc.loading()).toBe(true);

    httpMock
      .expectOne('/api/boom')
      .flush('server error', { status: 500, statusText: 'Internal Server Error' });

    expect(loadingSvc.loading()).toBe(false);
  });

  it('stays loading until the LAST of several overlapping requests settles (fixes the old boolean bug)', () => {
    httpClient.get('/api/a').subscribe();
    httpClient.get('/api/b').subscribe({ error: () => undefined });

    expect(loadingSvc.loading()).toBe(true); // two in flight

    // Old naive boolean would clear here even though /api/b is still pending.
    httpMock.expectOne('/api/a').flush({});
    expect(loadingSvc.loading()).toBe(true);

    httpMock
      .expectOne('/api/b')
      .flush('server error', { status: 500, statusText: 'Internal Server Error' });
    expect(loadingSvc.loading()).toBe(false);
  });
});
