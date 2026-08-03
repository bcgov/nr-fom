import { AttachmentResolverSvc } from '@admin-core/services/AttachmentResolverSvc';
import { CommentScopeOpt } from '@admin-core/utils/constants';
import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import {
    AttachmentService, InteractionService, ProjectService,
    PublicCommentService, SpatialFeatureService
} from '@api-client';
import { ConfigService } from '@utility/services/config.service';
import { of, throwError } from 'rxjs';
import { DetailsMapComponent } from '../details-map/details-map.component';
import { ShapeInfoComponent } from '../shape-info/shape-info.component';
import { CommentsSummaryComponent } from './comments-summary/comments-summary.component';
import { InteractionsSummaryComponent } from './interactions-summary/interactions-summary.component';
import { SummaryComponent } from './summary.component';

// Leaflet and the summary tables are not what is under test, and Leaflet does not work in jsdom.
@Component({ selector: 'app-details-map', template: '' })
class StubDetailsMapComponent {
  readonly projectSpatialDetail = input<unknown>();
}
@Component({ selector: 'app-shape-info', template: '' })
class StubShapeInfoComponent {
  readonly projectSpatialDetail = input<unknown>(undefined, { alias: 'spatialDetail' });
}
@Component({ selector: 'app-comments-summary', template: '<div class="stub-comments">{{ publicCommentDetails()?.length ?? 0 }} comments</div>' })
class StubCommentsSummaryComponent {
  readonly publicCommentDetails = input<{ id: number }[]>();
  readonly requestError = input<boolean | undefined>(undefined);
}
@Component({ selector: 'app-interactions-summary', template: '<div class="stub-interactions">{{ interactionDetails()?.length ?? 0 }} engagements</div>' })
class StubInteractionsSummaryComponent {
  readonly interactionDetails = input<{ id: number }[]>();
  readonly requestError = input<boolean | undefined>(undefined);
}

describe('SummaryComponent', () => {
  let component: SummaryComponent;
  let fixture: ComponentFixture<SummaryComponent>;
  let projectMock: jest.Mock;
  let commentsMock: jest.Mock;
  let spatialMock: jest.Mock;
  let interactionsMock: jest.Mock;
  let attachmentsMock: jest.Mock;

  const project = {
    id: 5,
    name: 'Summary FOM',
    projectPlanCode: 'FSP',
    fspId: 123,
    workflowState: { code: 'COMMENT_CLOSED' },
    forestClient: { id: 99, name: 'A Client' },
  };

  // One commentable cut block plus a retention area, which buildCommentScopeOptions excludes.
  const spatialDetail = [
    { featureId: 1001, featureType: { code: 'cut_block' }, name: 'Block A' },
    { featureId: 2002, featureType: { code: 'retention_area' }, name: 'Retention' },
  ];

  const publicComments = [
    { id: 1, commentScope: { code: 'OVERALL' }, scopeCutBlockId: null, scopeRoadSectionId: null },
    { id: 2, commentScope: { code: 'CUT_BLOCK' }, scopeCutBlockId: 1001, scopeRoadSectionId: null },
    { id: 3, commentScope: { code: 'CUT_BLOCK' }, scopeCutBlockId: 9999, scopeRoadSectionId: null },
  ];

  async function createComponent() {
    fixture = TestBed.createComponent(SummaryComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('appId', '5');

    fixture.detectChanges();
    await flush();
  }

  // whenStable() alone is not enough: it tracks Angular's own pending work, so it would wait for a
  // resource but not a floating promise chain. Flush the macrotask queue explicitly.
  async function flush() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function renderedText() {
    return fixture.nativeElement.textContent as string;
  }

  /** Applies a scope selection the way the template's mat-select does. */
  async function selectScope(scope: { commentScopeCode: string | null; scopeId: number | null }) {
    component.onScopeOptionChanged(scope as CommentScopeOpt);
    await flush();
  }

  function renderedCommentCount() {
    return fixture.nativeElement.querySelector('.stub-comments')?.textContent?.trim();
  }

  beforeEach(async () => {
    projectMock = jest.fn().mockReturnValue(of(project));
    commentsMock = jest.fn().mockReturnValue(of(publicComments));
    spatialMock = jest.fn().mockReturnValue(of(spatialDetail));
    interactionsMock = jest.fn().mockReturnValue(of([{ id: 71 }, { id: 72 }]));
    attachmentsMock = jest.fn().mockReturnValue(of([
      { id: 21, fileName: 'supporting.pdf', attachmentType: { code: 'SUPPORTING_DOC' } },
      { id: 22, fileName: 'notice.pdf', attachmentType: { code: 'PUBLIC_NOTICE' } },
    ]));

    await TestBed.configureTestingModule({
      imports: [SummaryComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: ProjectService, useValue: { projectControllerFindOne: projectMock } },
        { provide: PublicCommentService, useValue: { publicCommentControllerFind: commentsMock } },
        { provide: SpatialFeatureService, useValue: { spatialFeatureControllerGetForProject: spatialMock } },
        { provide: InteractionService, useValue: { interactionControllerFind: interactionsMock } },
        { provide: AttachmentService, useValue: { attachmentControllerFind: attachmentsMock } },
        { provide: AttachmentResolverSvc, useValue: { getFileContents: jest.fn(), isDeleteAttachmentAllowed: () => false } },
        { provide: ConfigService, useValue: { getConfig: () => ({}) } },
      ],
    })
      .overrideComponent(SummaryComponent, {
        remove: {
          imports: [DetailsMapComponent, ShapeInfoComponent, CommentsSummaryComponent, InteractionsSummaryComponent],
        },
        add: {
          imports: [StubDetailsMapComponent, StubShapeInfoComponent, StubCommentsSummaryComponent, StubInteractionsSummaryComponent],
        },
      })
      .compileComponents();
  });

  describe('loading the report', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('requests all five sections for this project', () => {
      expect(projectMock).toHaveBeenCalledWith(5);
      expect(commentsMock).toHaveBeenCalledWith(5);
      expect(spatialMock).toHaveBeenCalledWith(5);
      expect(interactionsMock).toHaveBeenCalledWith(5);
      expect(attachmentsMock).toHaveBeenCalledWith(5);
    });

    it('renders the project details', () => {
      expect(renderedText()).toContain('123'); // FSP id, rendered only for an FSP plan
    });

    it('sorts attachments by type code', () => {
      const text = renderedText();
      expect(text.indexOf('notice.pdf')).toBeGreaterThan(-1);
      expect(text.indexOf('notice.pdf')).toBeLessThan(text.indexOf('supporting.pdf'));
    });

    it('shows the engagements section for the main report', () => {
      expect(renderedText()).toContain('2 engagements');
    });
  });

  describe('comment scope options', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('starts on the main report', () => {
      expect(component.selectedScope().commentScopeCode).toBeNull();
      expect(component.selectedScope().desc).toBe('Main Report');
    });

    it('offers main report, overall, and each commentable feature — excluding retention areas', () => {
      const descriptions = component.commentScopeOpts().map((o) => o.desc);
      expect(descriptions[0]).toBe('Main Report');
      expect(component.commentScopeOpts().some((o) => o.scopeId === 1001)).toBe(true);
      expect(component.commentScopeOpts().some((o) => o.scopeId === 2002)).toBe(false);
    });
  });

  describe('scope filtering', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('shows every comment on the main report', () => {
      expect(renderedCommentCount()).toBe('3 comments');
    });

    it('narrows comments to the selected cut block', async () => {
      await selectScope(component.commentScopeOpts().find((o) => o.scopeId === 1001)!);

      // Only comment 2 targets cut block 1001.
      expect(renderedCommentCount()).toBe('1 comments');
    });

    it('narrows comments to overall-only when Overall FOM is selected', async () => {
      await selectScope(component.commentScopeOpts().find((o) => o.commentScopeCode === 'OVERALL')!);

      expect(renderedCommentCount()).toBe('1 comments');
    });

    it('hides the engagements and attachments sections for a scoped selection', async () => {
      await selectScope(component.commentScopeOpts().find((o) => o.scopeId === 1001)!);

      expect(renderedText()).not.toContain('engagements');
      expect(renderedText()).not.toContain('notice.pdf');
    });

    it('returns to everything when the main report is reselected', async () => {
      await selectScope(component.commentScopeOpts().find((o) => o.scopeId === 1001)!);
      await selectScope(component.commentScopeOpts()[0]);

      expect(renderedCommentCount()).toBe('3 comments');
      expect(renderedText()).toContain('2 engagements');
    });
  });

  describe('per-section failures', () => {
    it('flags a failed comments request without breaking the rest of the report', async () => {
      commentsMock.mockReturnValue(throwError(() => new Error('boom')));
      await createComponent();

      expect(component.publicCommentsReqError()).toBe(true);
      expect(renderedText()).toContain('123'); // the project section still rendered
    });

    it('flags a failed attachments request in the attachments section', async () => {
      attachmentsMock.mockReturnValue(throwError(() => new Error('boom')));
      await createComponent();

      expect(component.attachmentsReqError()).toBe(true);
      expect(renderedText()).toContain('Request encountered error');
    });

    it('flags a failed engagements request', async () => {
      interactionsMock.mockReturnValue(throwError(() => new Error('boom')));
      await createComponent();

      expect(component.interactionsReqError()).toBe(true);
    });

    it('still builds scope options when only the project request fails', async () => {
      projectMock.mockReturnValue(throwError(() => new Error('boom')));
      await createComponent();

      expect(component.projectReqError()).toBe(true);
      expect(component.commentScopeOpts().some((o) => o.scopeId === 1001)).toBe(true);
    });
  });
});
