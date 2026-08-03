import { AttachmentResolverSvc } from '@admin-core/services/AttachmentResolverSvc';
import { CommonUtil } from '@admin-core/utils/commonUtil';
import { COMMENT_SCOPE_CODE, CommentScopeOpt } from '@admin-core/utils/constants';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import {
    AttachmentResponse, AttachmentService, InteractionResponse, InteractionService,
    ProjectPlanCodeEnum,
    ProjectResponse, ProjectService, PublicCommentAdminResponse, PublicCommentService,
    SpatialFeaturePublicResponse, SpatialFeatureService
} from '@api-client';
import { ConfigService } from '@utility/services/config.service';
import { DetailsMapComponent } from '../details-map/details-map.component';
import { ShapeInfoComponent } from '../shape-info/shape-info.component';
import { CommentsSummaryComponent } from './comments-summary/comments-summary.component';
import { InteractionsSummaryComponent } from './interactions-summary/interactions-summary.component';

@Component({
    imports: [
    RouterLink,
    FormsModule,
    DatePipe,
    MatFormFieldModule,
    MatSelectModule,
    MatOptionModule,
    DetailsMapComponent,
    ShapeInfoComponent,
    CommentsSummaryComponent,
    InteractionsSummaryComponent
],
    selector: 'app-summary',
    templateUrl: './summary.component.html',
    styleUrl: './summary.component.scss'
})
export class SummaryComponent {
  private projectSvc = inject(ProjectService);
  private commentSvc = inject(PublicCommentService);
  private spatialFeatureSvc = inject(SpatialFeatureService);
  private interactionSvc = inject(InteractionService);
  private attachmentSvc = inject(AttachmentService);
  private configSvc = inject(ConfigService);
  attachmentResolverSvc = inject(AttachmentResolverSvc);

  readonly appId = input.required<string>();

  readonly projectPlanCodeEnum = ProjectPlanCodeEnum;
  readonly periodOperationsTxt = "This FOM can be relied upon by the FOM holder for the purpose of a cutting permit or road permit application, until the date three years after commencement of the public review and commenting period. FOMs published by BC Timber Sales can be relied upon for the purpose of a cutting permit or road permit application, or the issuance of a Timber Sales License until the date three years after conclusion of the public review and commenting period.";
  readonly woodlotOperationsTxt = "Woodlots are not legally required to publish FOMs for public review and comment prior to cutting permit or road permit application. However, woodlot licensees may choose to publish FOMs on a voluntary basis to facilitate public engagement.";
  readonly projectId = computed(() => Number(this.appId()));

  // The five report sections load independently: one failing must not blank out the others, which is
  // why each keeps its own resource and its own error flag rather than sharing one request.
  private readonly projectResource = rxResource({
    params: () => this.projectId(),
    stream: ({ params }) => this.projectSvc.projectControllerFindOne(params),
  });
  private readonly commentsResource = rxResource({
    params: () => this.projectId(),
    stream: ({ params }) => this.commentSvc.publicCommentControllerFind(params),
  });
  private readonly spatialResource = rxResource({
    params: () => this.projectId(),
    stream: ({ params }) => this.spatialFeatureSvc.spatialFeatureControllerGetForProject(params),
  });
  private readonly interactionsResource = rxResource({
    params: () => this.projectId(),
    stream: ({ params }) => this.interactionSvc.interactionControllerFind(params),
  });
  private readonly attachmentsResource = rxResource({
    params: () => this.projectId(),
    stream: ({ params }) => this.attachmentSvc.attachmentControllerFind(params),
  });

  readonly project = computed(() => this.projectResource.hasValue() ? this.projectResource.value() : undefined);
  readonly publicComments = computed(() => this.commentsResource.hasValue() ? [...this.commentsResource.value()] : undefined);
  readonly spatialDetail = computed(() => this.spatialResource.hasValue() ? [...this.spatialResource.value()] : undefined);
  readonly interactions = computed(() => this.interactionsResource.hasValue() ? this.interactionsResource.value() : undefined);
  readonly attachments = computed(() => this.attachmentsResource.hasValue()
    ? [...this.attachmentsResource.value()].sort((a: AttachmentResponse, b: AttachmentResponse) =>
        a.attachmentType.code.localeCompare(b.attachmentType.code))
    : undefined);

  readonly projectReqError = computed(() => this.projectResource.status() === 'error');
  readonly publicCommentsReqError = computed(() => this.commentsResource.status() === 'error');
  readonly spatialDetailReqError = computed(() => this.spatialResource.status() === 'error');
  readonly interactionsReqError = computed(() => this.interactionsResource.status() === 'error');
  readonly attachmentsReqError = computed(() => this.attachmentsResource.status() === 'error');

  /** The "Main Report" entry, which shows every scope plus the engagement and attachment sections. */
  private static readonly mainReportOpt = {
    commentScopeCode: null, desc: 'Main Report', name: null, scopeId: null
  } as CommentScopeOpt;

  readonly commentScopeOpts = computed<Array<CommentScopeOpt>>(() => {
    const spatial = this.spatialDetail();
    if (!spatial) {
      return [];
    }
    return [
      SummaryComponent.mainReportOpt,
      ...CommonUtil.buildCommentScopeOptions(spatial).filter((opt) => opt.commentScopeCode !== null),
    ];
  });

  /**
   * The scope the report is filtered to. Re-seeds to "Main Report" whenever the option list is rebuilt
   * (i.e. once the spatial features load), and is otherwise driven by the user's selection.
   */
  readonly selectedScope = linkedSignal<Array<CommentScopeOpt>, CommentScopeOpt>({
    source: () => this.commentScopeOpts(),
    computation: (opts) => opts[0] ?? SummaryComponent.mainReportOpt,
  });

  readonly filteredSpatialDetail = computed<SpatialFeaturePublicResponse[]>(() => {
    const scope = this.selectedScope();
    return (this.spatialDetail() ?? []).filter((sDetail) =>
      (scope?.commentScopeCode == null || scope.commentScopeCode === COMMENT_SCOPE_CODE.OVERALL)
        || (sDetail.featureType.code === scope.commentScopeCode.toLowerCase() &&
            sDetail.featureId == scope.scopeId));
  });

  readonly filteredPublicComments = computed<PublicCommentAdminResponse[]>(() => {
    const scope = this.selectedScope();
    return (this.publicComments() ?? []).filter((comment) => {
      if (!scope || scope.commentScopeCode == null) {
        return true; // Everything.
      }
      else if (scope.commentScopeCode === COMMENT_SCOPE_CODE.OVERALL) {
        return comment.commentScope.code === scope.commentScopeCode;
      }
      return comment.commentScope.code === scope.commentScopeCode &&
              ((comment.scopeCutBlockId && comment.scopeCutBlockId == scope.scopeId) ||
              (comment.scopeRoadSectionId && comment.scopeRoadSectionId == scope.scopeId));
    });
  });

  onScopeOptionChanged(selection: CommentScopeOpt) {
    this.selectedScope.set(selection);
  }
}

