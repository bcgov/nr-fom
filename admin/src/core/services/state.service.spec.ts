import { TestBed } from '@angular/core/testing';
import { StateService } from './state.service';
import { DistrictService, PublicCommentService, ProjectService } from '@api-client';

describe('StateService', () => {
  let service: StateService;
  let mockPublicCommentService: Partial<PublicCommentService>;
  let mockDistrictService: Partial<DistrictService>;
  let mockProjectService: Partial<ProjectService>;

  beforeEach(() => {
    mockPublicCommentService = {
      responseCodeControllerFindAll: jest.fn(),
      commentScopeCodeControllerFindAll: jest.fn(),
    };
    mockDistrictService = {
      districtControllerFindAll: jest.fn(),
    };
    mockProjectService = {
      workflowStateCodeControllerFindAll: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        StateService,
        { provide: PublicCommentService, useValue: mockPublicCommentService },
        { provide: DistrictService, useValue: mockDistrictService },
        { provide: ProjectService, useValue: mockProjectService },
      ],
    });
    service = TestBed.inject(StateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start as not ready', () => {
    const spy = jest.fn();
    service.isReady$.subscribe(spy);
    expect(spy).toHaveBeenCalledWith(false);
  });

  it('should set ready', () => {
    const spy = jest.fn();
    service.isReady$.subscribe(spy);
    service.setReady();
    expect(spy).toHaveBeenCalledWith(true);
  });

  it('should set and get code tables', () => {
    const tables = { responseCode: [], district: [] } as any;
    service.setCodeTables(tables);
    expect(service.codeTables).toBe(tables);
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
});
