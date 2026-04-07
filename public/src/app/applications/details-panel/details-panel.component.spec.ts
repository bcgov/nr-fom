import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DetailsPanelComponent } from './details-panel.component';
import { ProjectService, SpatialFeatureService, AttachmentService } from '@api-client';
import { UrlService } from '@public-core/services/url.service';
import { FeatureSelectService } from '@utility/services/featureSelect.service';
import { ConfigService } from '@utility/services/config.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { of, Subject } from 'rxjs';

describe('DetailsPanelComponent', () => {
  let component: DetailsPanelComponent;
  let fixture: ComponentFixture<DetailsPanelComponent>;
  let mockProjectService: Partial<ProjectService>;
  let mockSpatialFeatureService: Partial<SpatialFeatureService>;
  let mockAttachmentService: Partial<AttachmentService>;
  let mockUrlService: Partial<UrlService>;
  let mockFeatureSelectService: Partial<FeatureSelectService>;
  let mockConfigService: Partial<ConfigService>;
  let mockModalService: Partial<NgbModal>;
  let navEndSubject: Subject<any>;

  beforeEach(async () => {
    navEndSubject = new Subject<any>();

    mockProjectService = {
      workflowStateCodeControllerFindAll: jest.fn().mockReturnValue(of([
        { code: 'INITIAL', description: 'Initial' },
        { code: 'PUBLISHED', description: 'Published' },
      ])),
      projectControllerFindOne: jest.fn().mockReturnValue(of({
        id: 1,
        name: 'Test Project',
      })),
    };

    mockSpatialFeatureService = {
      spatialFeatureControllerGetForProject: jest.fn().mockReturnValue(of([])),
    };

    mockAttachmentService = {
      attachmentControllerFind: jest.fn().mockReturnValue(of([])),
    };

    mockUrlService = {
      onNavEnd$: navEndSubject.asObservable() as any,
      getQueryParam: jest.fn().mockReturnValue(null),
      setQueryParam: jest.fn(),
    };

    mockFeatureSelectService = {
      $currentSelected: new Subject<any>(),
    };

    mockConfigService = {
      getEnvironmentDisplay: jest.fn().mockReturnValue('Dev'),
    };

    mockModalService = {
      open: jest.fn().mockReturnValue({
        result: Promise.resolve(),
        dismiss: jest.fn(),
        componentInstance: {},
      }),
    };

    await TestBed.configureTestingModule({
      imports: [DetailsPanelComponent],
      providers: [
        provideRouter([]),
        { provide: ProjectService, useValue: mockProjectService },
        { provide: SpatialFeatureService, useValue: mockSpatialFeatureService },
        { provide: AttachmentService, useValue: mockAttachmentService },
        { provide: UrlService, useValue: mockUrlService },
        { provide: FeatureSelectService, useValue: mockFeatureSelectService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: NgbModal, useValue: mockModalService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DetailsPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load workflow state codes on init', () => {
    expect(mockProjectService.workflowStateCodeControllerFindAll).toHaveBeenCalled();
  });

  it('should populate workflowStatus', () => {
    expect(component.workflowStatus).toBeDefined();
    expect(component.workflowStatus['INITIAL']).toBeDefined();
    expect(component.workflowStatus['PUBLISHED']).toBeDefined();
  });

  it('should have projectPlanCodeEnum', () => {
    expect(component.projectPlanCodeEnum).toBeDefined();
  });

  it('should have faArrowUpRightFromSquare icon', () => {
    expect(component.faArrowUpRightFromSquare).toBeDefined();
  });

  describe('clearAllFilters', () => {
    it('should reset projectIdFilter', () => {
      component.projectIdFilter.filter.value = '42';
      component.clearAllFilters();
      expect(component.projectIdFilter.filter.value).toBeNull();
    });
  });

  describe('loadQueryParameters', () => {
    it('should load project id from url', () => {
      (mockUrlService.getQueryParam as jest.Mock).mockReturnValue('99');
      component.loadQueryParameters();
      expect(component.projectIdFilter.filter.value).toBe('99');
    });
  });

  describe('ngOnDestroy', () => {
    it('should unsubscribe', () => {
      const nextSpy = jest.spyOn(component['ngUnsubscribe'], 'next');
      const completeSpy = jest.spyOn(component['ngUnsubscribe'], 'complete');
      component.ngOnDestroy();
      expect(nextSpy).toHaveBeenCalled();
      expect(completeSpy).toHaveBeenCalled();
    });

    it('should dismiss comment modal if exists', () => {
      const mockDismiss = jest.fn();
      component.addCommentModal = {
        componentInstance: { dismiss: mockDismiss },
      } as any;
      component.ngOnDestroy();
      expect(mockDismiss).toHaveBeenCalledWith('destroying');
    });

    it('should not throw if comment modal is null', () => {
      component.addCommentModal = null;
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('getProjectDetails', () => {
    it('should set project to null when no project id in query params', () => {
      (mockUrlService.getQueryParam as jest.Mock).mockReturnValue(null);
      component.getProjectDetails();
      expect(component.project).toBeNull();
    });
  });
});
