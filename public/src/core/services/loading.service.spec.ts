import { TestBed } from '@angular/core/testing';
import { LoadingService } from './loading.service';

describe('LoadingService', () => {
  let service: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LoadingService] });
    service = TestBed.inject(LoadingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should track loading via in-flight request count', () => {
    expect(service.loading()).toBe(false);
    service.requestStarted();
    expect(service.loading()).toBe(true);
    service.requestStarted(); // two overlapping requests
    service.requestFinished();
    expect(service.loading()).toBe(true); // one still in flight
    service.requestFinished();
    expect(service.loading()).toBe(false);
  });

  it('should not go negative when finished is called more than started', () => {
    service.requestFinished();
    expect(service.loading()).toBe(false);
    service.requestStarted();
    expect(service.loading()).toBe(true); // single start still loads, not offset by the earlier extra finish
  });
});
