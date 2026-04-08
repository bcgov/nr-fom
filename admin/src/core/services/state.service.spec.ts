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

  it('should set and get loading state', () => {
    service.loading = true;
    expect(service.loading).toBe(true);
    service.loading = false;
    expect(service.loading).toBe(false);
  });
});
