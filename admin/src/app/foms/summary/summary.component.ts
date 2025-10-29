import { AttachmentResolverSvc } from '@admin-core/services/AttachmentResolverSvc';
import { CommonUtil } from '@admin-core/utils/commonUtil';
import { COMMENT_SCOPE_CODE, CommentScopeOpt } from '@admin-core/utils/constants';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
    AttachmentResponse, AttachmentService, InteractionResponse, InteractionService,
    ProjectPlanCodeEnum,
    ProjectResponse, ProjectService, PublicCommentAdminResponse, PublicCommentService,
    SpatialFeaturePublicResponse, SpatialFeatureService
} from '@api-client';
import { ConfigService } from '@utility/services/config.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DetailsMapComponent } from '../details-map/details-map.component';
import { ShapeInfoComponent } from '../shape-info/shape-info.component';
import { CommentsSummaryComponent } from './comments-summary/comments-summary.component';
import { InteractionsSummaryComponent } from './interactions-summary/interactions-summary.component';

@Component({
    standalone: true,
    imports: [
        RouterLink, 
        FormsModule, 
        NgFor, 
        NgIf,
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
    styleUrls: ['./summary.component.scss']
})
export class SummaryComponent implements OnInit, OnDestroy {
  readonly projectPlanCodeEnum = ProjectPlanCodeEnum;
  readonly periodOperationsTxt = "This FOM can be relied upon by the FOM holder for the purpose of a cutting permit or road permit application, until the date three years after commencement of the public review and commenting period. FOMs published by BC Timber Sales can be relied upon for the purpose of a cutting permit or road permit application, or the issuance of a Timber Sales License until the date three years after conclusion of the public review and commenting period.";
  readonly woodlotOperationsTxt = "Woodlots are not legally required to publish FOMs for public review and comment prior to cutting permit or road permit application. However, woodlot licensees may choose to publish FOMs on a voluntary basis to facilitate public engagement.";
  projectId: number;
  project: ProjectResponse;
  projectReqError: boolean;
  publicComments: PublicCommentAdminResponse[];
  filteredPublicComments: PublicCommentAdminResponse[];
  publicCommentsReqError: boolean;
  spatialDetail: SpatialFeaturePublicResponse[];
  filteredSpatialDetail: SpatialFeaturePublicResponse[];
  spatialDetailReqError: boolean;
  interactions: InteractionResponse[]
  interactionsReqError: boolean;
  attachments: AttachmentResponse[];
  attachmentsReqError: boolean;
  commentScopeOpts :Array<CommentScopeOpt> = [];
  selectedScope: CommentScopeOpt;

  private ngUnsubscribe$: Subject<void> = new Subject<void>();
  private scopeOptionChange$ = new Subject<CommentScopeOpt>(); // To notify when scope 'option' changed.

  constructor(    
    private route: ActivatedRoute,
    private projectSvc: ProjectService,
    private commentSvc: PublicCommentService,
    private spatialFeatureSvc: SpatialFeatureService,
    private interactionSvc: InteractionService,
    private attachmentSvc: AttachmentService,
    private configSvc: ConfigService,
    public attachmentResolverSvc: AttachmentResolverSvc
  ) { }

  async ngOnInit(): Promise<void> {
    this.projectId = this.route.snapshot.params.appId;
    this.getProject(this.projectId); 
    this.getpublicComments(this.projectId);
    this.getSpatialDetails(this.projectId);
    this.getProjectInteractions(this.projectId);
    this.getProjectAttachments(this.projectId);

    this.scopeOptionChange$.pipe(takeUntil(this.ngUnsubscribe$)).subscribe((nextScope) => {
      this.doFiltering(nextScope);
    });
  }

  private async getProject(projectId: number) {
    this.projectSvc.projectControllerFindOne(projectId).toPromise()
        .then(
          (result) => {this.project = result;},
          (error) => {
            console.error(`Error retrieving Project for Summary Report:`, error);
            this.project = undefined;
            this.projectReqError = true;
          }
        );
  }

  private async getpublicComments(projectId: number) {
    this.commentSvc.publicCommentControllerFind(projectId).toPromise()
        .then(
          (result) => {this.filteredPublicComments = this.publicComments = [...result];},
          (error) => {
            console.error(`Error retrieving Public Comments for Summary Report:`, error);
            this.publicComments = undefined;
            this.publicCommentsReqError = true;
          }
        );
  }

  private async getSpatialDetails(projectId: number) {
    this.spatialFeatureSvc.spatialFeatureControllerGetForProject(projectId).toPromise()
    .then(
      (result) => {
        this.spatialDetail = this.filteredSpatialDetail = [...result];
        this.commentScopeOpts =  CommonUtil.buildCommentScopeOptions(result);
        this.commentScopeOpts = this.commentScopeOpts.filter((opt) => opt.commentScopeCode !== null);
        const mainRptOpt = {commentScopeCode: null, desc: 'Main Report', name: null, scopeId: null} as CommentScopeOpt;
        this.selectedScope = mainRptOpt;
        this.commentScopeOpts.unshift(mainRptOpt);
      },
      (error) => {
        console.error(`Error retrieving Spatil Details for Summary Report:`, error);
        this.spatialDetail = undefined;
        this.spatialDetailReqError = true;
      }
    );
  }

  private async getProjectInteractions(projectId: number) {
    this.interactionSvc.interactionControllerFind(projectId).toPromise()
    .then(
      (result) => {this.interactions = result;},
      (error) => {
        console.error(`Error retrieving Project Interactions for Summary Report:`, error);
        this.interactions = undefined;
        this.interactionsReqError = true;
      }
    );
  }

  private async getProjectAttachments(projectId: number) {
    this.attachmentSvc.attachmentControllerFind(projectId).toPromise()
    .then(
      (result) => {
        this.attachments  = result.sort((a: AttachmentResponse, b: AttachmentResponse) => 
            a.attachmentType.code.localeCompare(b.attachmentType.code)
        )
      },
      (error) => {
        console.error(`Error retrieving Project Attachments for Summary Report:`, error);
        this.attachments = undefined;
        this.attachmentsReqError = true;
      }
    );
  }

  private doFiltering(nextScope: CommentScopeOpt) {

    // filtering on spatialDetail
    this.filteredSpatialDetail = this.spatialDetail.filter((sDetail) => {
      return (nextScope.commentScopeCode == null || nextScope.commentScopeCode === COMMENT_SCOPE_CODE.OVERALL) 
          || (sDetail.featureType.code === nextScope.commentScopeCode.toLowerCase() &&
              sDetail.featureId == nextScope.scopeId);
    });

    // filtering on publicComments
    this.filteredPublicComments = this.publicComments.filter((comment) => {
      if (!nextScope || nextScope.commentScopeCode == null) {
        return true; // Everything.
      }
      else if (nextScope.commentScopeCode === COMMENT_SCOPE_CODE.OVERALL) {
        return comment.commentScope.code === nextScope.commentScopeCode;
      }
      return comment.commentScope.code === nextScope.commentScopeCode &&
              ((comment.scopeCutBlockId && comment.scopeCutBlockId == nextScope.scopeId) ||
              (comment.scopeRoadSectionId && comment.scopeRoadSectionId == nextScope.scopeId));
    });
  }

  onScopeOptionChanged(selection: CommentScopeOpt) {
    this.scopeOptionChange$.next(selection);
  }

  ngOnDestroy() {
    this.ngUnsubscribe$.next();
    this.ngUnsubscribe$.complete();
  }
}

