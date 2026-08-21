import { AttachmentResolverSvc } from '@admin-core/services/AttachmentResolverSvc';
import { CognitoService } from '@admin-core/services/cognito.service';
import { ModalService } from '@admin-core/services/modal.service';
import { Component, input, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { ProjectService } from '@api-client';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FeatureSelectService } from '@utility/services/featureSelect.service';
import { of } from 'rxjs';
import { DetailsMapComponent } from '../details-map/details-map.component';
import { ShapeInfoComponent } from '../shape-info/shape-info.component';
import { FomDetailComponent } from './fom-detail.component';

// Mimics a real HTTP response: resolves on a later macrotask, never synchronously like of().
function asyncOf<T>(value: T) {
  return of(value).pipe();
}
function asyncPromiseOf<T>(value: T) {
  return { toPromise: () => new Promise<T>((resolve) => setTimeout(() => resolve(value), 0)) };
}

// Leaflet and the shape table are irrelevant here and do not work in jsdom.
@Component({ selector: 'app-details-map', template: '' })
class StubDetailsMapComponent {
  readonly projectSpatialDetail = input<unknown>();
}
@Component({ selector: 'app-shape-info', template: '' })
class StubShapeInfoComponent {
  readonly spatialDetail = input<unknown>();
}

describe('FomDetailComponent', () => {
  let component: FomDetailComponent;
  let fixture: ComponentFixture<FomDetailComponent>;
  let findOneMock: jest.Mock;
  let classificationChangeMock: jest.Mock;
  let getAttachmentsMock: jest.Mock;

  function project(overrides: Record<string, unknown> = {}) {
    return {
      id: 42,
      name: 'Test FOM Holder',
      description: 'A description',
      revisionCount: 1,
      commentingOpenDate: '2026-01-01',
      commentingClosedDate: '2026-03-01',
      commentClassificationMandatory: true,
      workflowState: { code: 'COMMENT_OPEN' },
      forestClient: { id: 99 },
      ...overrides,
    };
  }

  async function createComponent(projectDetail: Record<string, unknown> | undefined = project()) {
    fixture = TestBed.createComponent(FomDetailComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('projectDetail', projectDetail);
    fixture.componentRef.setInput('spatialDetail', [{ featureId: 1 }]);
    fixture.componentRef.setInput('projectMetrics', { totalCommentsCount: 3, respondedToCommentsCount: 1 });

    fixture.detectChanges();
    await flush();
  }

  // whenStable() alone is not enough: it tracks Angular's own pending work, so it would wait for a
  // resource but not a bare subscribe or a floating promise. Flush the macrotask queue explicitly.
  async function flush() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function renderedText() {
    return fixture.nativeElement.textContent as string;
  }

  /**
   * The rendered "Comment Classification" value. Read from its own element rather than the whole page:
   * the toggle button always shows the opposite label ("Change to Not Mandatory"), so a substring
   * search over the page text cannot distinguish the two states.
   */
  function classificationText() {
    const items = Array.from(fixture.nativeElement.querySelectorAll('li')) as HTMLElement[];
    const item = items.find((el) => el.querySelector('.name')?.textContent?.includes('Comment Classification'));
    return item?.querySelector('.value')?.textContent?.trim() ?? '';
  }

  beforeEach(async () => {
    findOneMock = jest.fn().mockReturnValue(asyncOf(project({ commentClassificationMandatory: false })));
    classificationChangeMock = jest.fn().mockReturnValue(asyncPromiseOf({}));
    // Left pending by default so most tests render a FOM with no attachment list; the 'attachments'
    // block below resolves it explicitly.
    getAttachmentsMock = jest.fn().mockReturnValue(new Promise(() => { /* never settles */ }));

    await TestBed.configureTestingModule({
      imports: [FomDetailComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {
          provide: ProjectService,
          useValue: {
            projectControllerFindOne: findOneMock,
            projectControllerCommentClassificationMandatoryChange: classificationChangeMock,
            projectControllerRemove: jest.fn().mockReturnValue(of({})),
            projectControllerStateChange: jest.fn().mockReturnValue(asyncPromiseOf({})),
          },
        },
        {
          provide: CognitoService,
          useValue: {
            getUser: () => ({
              isMinistry: true,
              isForestClient: false,
              isAuthorizedForClientId: () => true,
            }),
          },
        },
        {
          provide: ModalService,
          useValue: {
            openConfirmationDialog: jest.fn().mockReturnValue({ afterClosed: () => of(false) }),
            openWarningDialog: jest.fn(),
          },
        },
        {
          provide: AttachmentResolverSvc,
          useValue: {
            getAttachments: getAttachmentsMock,
            attachmentControllerRemove: jest.fn().mockResolvedValue({}),
            isDeleteAttachmentAllowed: () => true,
            getFileContents: jest.fn(),
          },
        },
        { provide: NgbModal, useValue: { open: jest.fn() } },
        { provide: FeatureSelectService, useValue: { currentSelected: signal(null) } },
      ],
    })
      .overrideComponent(FomDetailComponent, {
        remove: { imports: [DetailsMapComponent, ShapeInfoComponent] },
        add: { imports: [StubDetailsMapComponent, StubShapeInfoComponent] },
      })
      .compileComponents();
  });

  describe('initial load from the route resolver', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('renders the FOM number from the resolved project', () => {
      expect(renderedText()).toContain('FOM Number: 42');
    });

    it('renders the FOM holder name', () => {
      expect(renderedText()).toContain('Test FOM Holder');
    });

    it('does not refetch the project — the resolver already supplied it', () => {
      expect(findOneMock).not.toHaveBeenCalled();
    });

    it('requests the attachments for this project', () => {
      expect(getAttachmentsMock).toHaveBeenCalledWith(42);
    });

    it('computes days remaining against today for a commenting FOM', () => {
      expect(component.daysRemaining).not.toBeNull();
      expect(component.daysRemaining).toBeGreaterThanOrEqual(0);
    });

    it('is not flagged active outside the INITIAL state', () => {
      expect(component.isProjectActive).toBe(false);
    });
  });

  describe('attachments', () => {
    // Loading these into a plain field used to notify nothing, so `@if (attachments.length > 0)` first
    // evaluated during change detection's verification pass and tripped NG0100. createComponent() runs
    // change detection strictly, so this test also proves the list now reaches the view on its own.
    it('sorts public notice ahead of supporting documents and reaches the view', async () => {
      getAttachmentsMock.mockReturnValue(Promise.resolve([
        { id: 2, attachmentType: { code: 'SUPPORTING_DOC' } },
        { id: 1, attachmentType: { code: 'PUBLIC_NOTICE' } },
      ]));

      await createComponent();

      expect(component.attachments().map((a) => a.attachmentType.code))
        .toEqual(['PUBLIC_NOTICE', 'SUPPORTING_DOC']);
    });
  });

  describe('comment classification toggle', () => {
    // This is the path the removed cdr.detectChanges() existed for: an in-place refetch that must
    // reach the view without a full page reload.
    it('shows the refetched classification after toggling', async () => {
      await createComponent();
      expect(classificationText()).toBe('Mandatory');

      await component.setCommentClassification();
      await flush();

      expect(classificationChangeMock).toHaveBeenCalledWith(42, {
        commentClassificationMandatory: false,
        revisionCount: 1,
      });
      expect(findOneMock).toHaveBeenCalledWith(42);
      expect(classificationText()).toBe('Not Mandatory');
    });

    it('clears its in-progress flag when the call finishes', async () => {
      await createComponent();
      await component.setCommentClassification();
      await flush();
      expect(component.isSettingCommentClassification()).toBe(false);
    });
  });

  describe('defaults applied to the resolved project', () => {
    it('treats an undefined comment classification as mandatory', async () => {
      await createComponent(project({ commentClassificationMandatory: undefined }));
      expect(classificationText()).toBe('Mandatory');
    });

    it('flags an INITIAL FOM as active', async () => {
      await createComponent(project({ workflowState: { code: 'INITIAL' } }));
      expect(component.isProjectActive).toBe(true);
    });
  });

  describe('permission gates', () => {
    it('lets a ministry user withdraw a COMMENT_CLOSED FOM', async () => {
      await createComponent(project({ workflowState: { code: 'COMMENT_CLOSED' } }));
      expect(component.canWithdraw()).toBe(true);
    });

    it('does not let anyone withdraw while commenting is open', async () => {
      await createComponent(project({ workflowState: { code: 'COMMENT_OPEN' } }));
      expect(component.canWithdraw()).toBe(false);
    });

    it('allows finalizing only once commenting has closed', async () => {
      await createComponent(project({ workflowState: { code: 'COMMENT_CLOSED' } }));
      expect(component.canFinalize()).toBe(true);

      await createComponent(project({ workflowState: { code: 'COMMENT_OPEN' } }));
      expect(component.canFinalize()).toBe(false);
    });

    it('blocks editing a published FOM', async () => {
      await createComponent(project({ workflowState: { code: 'PUBLISHED' } }));
      expect(component.canEditFOM()).toBe(false);
    });

    it('allows comment classification changes only while commenting is open or closed', async () => {
      await createComponent(project({ workflowState: { code: 'COMMENT_OPEN' } }));
      expect(component.canSetCommentClassification()).toBe(true);

      await createComponent(project({ workflowState: { code: 'INITIAL' } }));
      expect(component.canSetCommentClassification()).toBe(false);
    });

    it('hides comments while the FOM is still INITIAL', async () => {
      await createComponent(project({ workflowState: { code: 'INITIAL' } }));
      expect(component.canAccessComments()).toBe(false);
    });

    it('allows editing public notice only when FOM is INITIAL and user is authorized', async () => {
      await createComponent(project({ workflowState: { code: 'INITIAL' } }));
      expect(component.canEditPublicNotice()).toBe(true);

      component.user.isAuthorizedForClientId = () => false;
      expect(component.canEditPublicNotice()).toBe(false);

      component.user.isAuthorizedForClientId = () => true;
      await createComponent(project({ workflowState: { code: 'PUBLISHED' } }));
      expect(component.canEditPublicNotice()).toBe(false);
    });

    it('allows viewing public notice for authorized client or ministry user regardless of workflow state', async () => {
      await createComponent(project({ workflowState: { code: 'INITIAL', publicNoticeId: undefined } }));
      expect(component.canViewPublicNotice()).toBe(true);

      await createComponent(project({ workflowState: { code: 'PUBLISHED', publicNoticeId: 55 } }));
      expect(component.canViewPublicNotice()).toBe(true);

      component.user.isAuthorizedForClientId = () => false;
      component.user.isMinistry = false;
      expect(component.canViewPublicNotice()).toBe(false);
    });
  });

  describe('zero-state FOM without public notice', () => {
    it('renders project detail safely when publicNoticeId is undefined', async () => {
      await createComponent(project({ publicNoticeId: undefined, workflowState: { code: 'INITIAL' } }));
      expect(component.project().publicNoticeId).toBeUndefined();
      expect(fixture.nativeElement.textContent).toContain('Test FOM Holder');
    });
  });
});
