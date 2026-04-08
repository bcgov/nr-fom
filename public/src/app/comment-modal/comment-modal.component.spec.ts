import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommentModalComponent } from './comment-modal.component';
import { PublicCommentService } from '@api-client';

describe('CommentModalComponent', () => {
  let component: CommentModalComponent;
  let fixture: ComponentFixture<CommentModalComponent>;
  let mockActiveModal: Partial<NgbActiveModal>;
  let mockCommentService: Partial<PublicCommentService>;

  // Helper to create an observable-like with toPromise()
  function observableWithPromise(value: any) {
    return { toPromise: () => Promise.resolve(value) };
  }

  function observableWithError(err: any) {
    return { toPromise: () => Promise.reject(err) };
  }

  beforeEach(async () => {
    mockActiveModal = {
      dismiss: jest.fn(),
    };

    mockCommentService = {
      publicCommentControllerCreate: jest.fn().mockReturnValue(observableWithPromise({})),
    };

    await TestBed.configureTestingModule({
      imports: [CommentModalComponent, FormsModule],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: PublicCommentService, useValue: mockCommentService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CommentModalComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start on page 1', () => {
    expect(component.currentPage).toBe(1);
  });

  it('should start with iAgreeModel false', () => {
    expect(component.iAgreeModel).toBe(false);
  });

  it('should have feedbackLimit of 4000', () => {
    expect(component.feedbackLimit).toBe(4000);
  });

  it('should not be submitting initially', () => {
    expect(component.submitting).toBe(false);
  });

  describe('ngOnInit', () => {
    it('should set default commentScopeCode to OVERALL', () => {
      component.projectId = 1;
      component.ngOnInit();
      expect(component.publicComment.commentScopeCode).toBe('OVERALL');
    });

    it('should set projectId on publicComment', () => {
      component.projectId = 42;
      component.ngOnInit();
      expect(component.publicComment.projectId).toBe(42);
    });

    it('should populate commentScopeOpts with OVERALL option', () => {
      component.projectId = 1;
      component.ngOnInit();
      expect(component.commentScopeOpts.length).toBeGreaterThanOrEqual(1);
      expect(component.commentScopeOpts[0].commentScopeCode).toBe('OVERALL');
    });

    it('should set selectedScope to OVERALL by default', () => {
      component.projectId = 1;
      component.ngOnInit();
      expect(component.selectedScope.commentScopeCode).toBe('OVERALL');
    });

    it('should add spatial details to commentScopeOpts', () => {
      component.projectId = 1;
      component.projectSpatialDetail = [
        {
          featureId: 1,
          featureType: { code: 'cut_block', description: 'Cut Block' },
          name: 'Block A',
        },
        {
          featureId: 2,
          featureType: { code: 'road_section', description: 'Road Section' },
          name: 'Road 1',
        },
      ] as any;
      component.ngOnInit();
      expect(component.commentScopeOpts.length).toBe(3);
    });

    it('should filter out retention_area spatial details', () => {
      component.projectId = 1;
      component.projectSpatialDetail = [
        {
          featureId: 1,
          featureType: { code: 'retention_area', description: 'Retention Area' },
          name: 'Retention 1',
        },
      ] as any;
      component.ngOnInit();
      expect(component.commentScopeOpts.length).toBe(1);
    });
  });

  describe('navigation', () => {
    it('should increment page on p1_next', () => {
      component.p1_next();
      expect(component.currentPage).toBe(2);
    });

    it('should decrement page on p2_back', () => {
      component.currentPage = 2;
      component.p2_back();
      expect(component.currentPage).toBe(1);
    });

    it('should increment page on p2_next', () => {
      component.currentPage = 2;
      component.p2_next();
      expect(component.currentPage).toBe(3);
    });

    it('should decrement page on p3_back', () => {
      component.currentPage = 3;
      component.p3_back();
      expect(component.currentPage).toBe(2);
    });
  });

  describe('dismiss', () => {
    it('should call activeModal.dismiss with reason', () => {
      component.dismiss('cancel');
      expect(mockActiveModal.dismiss).toHaveBeenCalledWith('cancel');
    });
  });

  describe('p3_next (submit)', () => {
    beforeEach(() => {
      component.projectId = 1;
      component.ngOnInit();
    });

    it('should set submitting to true when submitting', () => {
      (mockCommentService.publicCommentControllerCreate as jest.Mock).mockReturnValue(
        { toPromise: () => new Promise(() => {}) } // never resolves
      );
      component.p3_next();
      expect(component.submitting).toBe(true);
    });

    it('should call publicCommentControllerCreate', () => {
      component.p3_next();
      expect(mockCommentService.publicCommentControllerCreate).toHaveBeenCalled();
    });

    it('should set scopeCutBlockId when CUT_BLOCK selected', () => {
      component.selectedScope = {
        commentScopeCode: 'CUT_BLOCK' as any,
        desc: 'Cut Block',
        name: 'Block A',
        scopeId: 10,
      };
      component.p3_next();
      expect(component.publicComment.scopeCutBlockId).toBe(10);
    });

    it('should set scopeRoadSectionId when ROAD_SECTION selected', () => {
      component.selectedScope = {
        commentScopeCode: 'ROAD_SECTION' as any,
        desc: 'Road Section',
        name: 'Road 1',
        scopeId: 20,
      };
      component.p3_next();
      expect(component.publicComment.scopeRoadSectionId).toBe(20);
    });

    it('should set up success callback to advance page and reset submitting', () => {
      const thenSpy = jest.fn().mockReturnValue({ catch: jest.fn() });
      (mockCommentService.publicCommentControllerCreate as jest.Mock).mockReturnValue(
        { toPromise: () => ({ then: thenSpy }) }
      );
      component.p3_next();
      expect(thenSpy).toHaveBeenCalled();
    });

    it('should set submitting to false on error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (mockCommentService.publicCommentControllerCreate as jest.Mock).mockReturnValue(
        observableWithError(new Error('submit error'))
      );
      component.p3_next();
      await Promise.resolve();
      await fixture.whenStable();
      expect(component.submitting).toBe(false);
      consoleSpy.mockRestore();
    });
  });
});
