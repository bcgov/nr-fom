import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, firstValueFrom } from 'rxjs';

import { CognitoService } from "@admin-core/services/cognito.service";
import { ModalService } from '@admin-core/services/modal.service';
import { StateService } from '@admin-core/services/state.service';
import { CommonUtil } from '@admin-core/utils/commonUtil';
import { BC_TIME_ZONE, COMMENT_SCOPE_CODE, CommentScopeOpt } from '@admin-core/utils/constants';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import {
  ProjectResponse, ProjectService, PublicCommentAdminResponse,
  PublicCommentAdminUpdateRequest, PublicCommentService, SpatialFeatureService
} from '@api-client';
import { User } from "@utility/security/user";
import { indexBy } from 'remeda';
import { takeUntil } from 'rxjs/operators';
import { CommentDetailComponent } from './comment-detail/comment-detail.component';
import { ExportTermsModalComponent } from './export-terms-modal/export-terms-modal.component';

@Component({
    standalone: true,
    imports: [
        NgIf, 
        RouterLink, 
        MatFormFieldModule, 
        MatSelectModule, 
        FormsModule, 
        NgFor, 
        MatOptionModule, 
        CommentDetailComponent,
        DatePipe
    ],
    selector: 'app-review-comments',
    templateUrl: './review-comments.component.html',
    styleUrls: ['./review-comments.component.scss']
})
export class ReviewCommentsComponent implements OnInit, OnDestroy {

  @ViewChild('commentListScrollContainer', { read: ElementRef })
  public commentListScrollContainer!: ElementRef;
  @ViewChild('commentDetailForm') 
  commentDetailForm!: CommentDetailComponent;

  public responseCodes = this.stateSvc.getCodeTable('responseCode')
  public commentScopeCodes = indexBy(this.stateSvc.getCodeTable('commentScopeCode'), (x) => x.code);
  public loading = false;
  public projectId!: number;
  public project!: ProjectResponse;
  public selectedItem: PublicCommentAdminResponse | null = null;
  public user: User;
  public commentScopeOpts :Array<CommentScopeOpt> = [];
  public selectedScope!: CommentScopeOpt;

  public allPublicComments: PublicCommentAdminResponse[] = [];
  public filteredPublicComments: PublicCommentAdminResponse[] = [];
  public hasAnyPublicComments = false;
  public exportInProgress = false;
  public exportSuccess = false;
  private ngUnsubscribe: Subject<void> = new Subject<void>();
  private triggered$ = new Subject<void>(); // To notify when 'save' or scope 'select' happen.
  private exportFeedbackTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly exportDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'long',
    timeZone: BC_TIME_ZONE
  });

  constructor(
    private route: ActivatedRoute,
    private commentSvc: PublicCommentService,
    private stateSvc: StateService,
    private projectSvc: ProjectService,
    private spatialFeatureService: SpatialFeatureService,
    private cognitoService: CognitoService,
    private modalSvc: ModalService
  ) {
    this.user = this.cognitoService.getUser()!;
  }

  ngOnInit() {
    if (this.commentListScrollContainer && this.commentListScrollContainer.nativeElement) {
      this.commentListScrollContainer.nativeElement.scrollTop = 0;
    }
    
    this.projectId = this.route.snapshot.params.appId;
    firstValueFrom(this.projectSvc.projectControllerFindOne(this.projectId))
      .then((result) => {this.project = result;});

    firstValueFrom(this.spatialFeatureService.spatialFeatureControllerGetForProject(this.projectId))
      .then((spatialDetails) => {
        this.commentScopeOpts =  CommonUtil.buildCommentScopeOptions(spatialDetails);
        this.selectedScope = this.commentScopeOpts.filter(opt => opt.commentScopeCode == null)[0]; // allOpt;
      });

    this.triggered$.pipe(takeUntil(this.ngUnsubscribe)).subscribe(() => {
      this.commentSvc.publicCommentControllerFind(this.projectId).pipe(takeUntil(this.ngUnsubscribe)).subscribe((comments) => {
        this.allPublicComments = comments ?? [];
        this.hasAnyPublicComments = this.allPublicComments.length > 0;
        this.filteredPublicComments = this.filterProjectComments(this.allPublicComments, this.selectedScope);
      });
    });

    this.triggered$.next();
  }

  filterProjectComments(comments: PublicCommentAdminResponse[], scope: CommentScopeOpt): PublicCommentAdminResponse[] {
    return comments.filter((comment) => {
      if (!scope || scope.commentScopeCode == null) {
        return true; // No filtering on scope. everything.
      }
      else if (scope.commentScopeCode === COMMENT_SCOPE_CODE.OVERALL) {
        return comment.commentScope.code === scope.commentScopeCode;
      }
      return comment.commentScope.code === scope.commentScopeCode &&
              ((comment.scopeCutBlockId && comment.scopeCutBlockId == scope.scopeId) ||
              (comment.scopeRoadSectionId && comment.scopeRoadSectionId == scope.scopeId));
    });
  }

  onScopeOptionChanged(_selection: CommentScopeOpt) {
    this.triggered$.next();
  }

  /**
   * @param item item to be set to child component.
   * @param pos scroll position (from the list). When user clicks, no need to save it, only until user click 'save' then 
   *            the saveComment() method will call this to update again the selected item and set selected item to child
   *            component and at the same time passing 'pos' to scroll to correct position for the list. Will need 
   *            setTimeout to delay scrolling after view is good.
   */
  onReviewItemClicked(item: PublicCommentAdminResponse, pos: number) {
    this.selectedItem = item;
    if (pos) {
      // !! important to wait or will not see the effect.
      setTimeout(() => {
        this.commentListScrollContainer.nativeElement.scrollTop = pos;
      }, 150);
    }
  }

  canReplyComment() {
    const userCanModify = this.user.isAuthorizedForClientId(this.project.forestClient.id);
    return userCanModify && (this.project.workflowState['code'] === 'COMMENT_OPEN'
                            || this.project.workflowState['code'] === 'COMMENT_CLOSED');
  }

  async saveComment(update: PublicCommentAdminUpdateRequest, selectedComment: PublicCommentAdminResponse) {
    if (!this.canReplyComment()) {
      return;
    }
    const {id} = selectedComment;

    try {
      this.loading = true;
      const result = await firstValueFrom(this.commentSvc.publicCommentControllerUpdate(id, update));

      // scroll position, important to get it first!!
      const pos = this.commentListScrollContainer.nativeElement.scrollTop;

      // Comment is saved successfully, so triggering service to retrieve comment list 
      // from backend for consistent state of the list at frontend.
      this.triggered$.next();
      this.selectedItem = result; // updated selected.
      this.loading = false;
      setTimeout(() => {
        if (this.selectedItem) {
          this.onReviewItemClicked(this.selectedItem, pos);
        }
      }, 300);

    } catch (err) {
      console.error("Failed to save comment.", err)
      this.loading = false;
    }
  }

  confirmExportAllComments(): void {
    const dialogRef = this.modalSvc.openComponentDialog(
      ExportTermsModalComponent,
      null,
      { width: '760px', maxWidth: '90vw', autoFocus: false }
    );

    dialogRef.afterClosed().subscribe((confirm) => {
      if (confirm) {
        this.exportAllComments();
      }
    });
  }

  exportAllComments(): void {
    if (!this.allPublicComments.length || this.exportInProgress) {
      return;
    }

    this.exportInProgress = true;
    this.exportSuccess = false;

    try {
      const exportRows = this.allPublicComments.map((comment) => ({
        "Feature Type": comment.commentScope?.description ?? '',
        "Feature Name": comment.scopeFeatureName ?? '',
        "Feature ID": comment.scopeCutBlockId ?? comment.scopeRoadSectionId ?? '',
        "Comment Date/Time": this.formatCreateTimeForExport(comment.createTimestamp),
        "From": comment.name ?? 'Anonymous',
        "Email": comment.email ?? '',
        "Phone Number": comment.phoneNumber ?? '',
        "Location": comment.location ?? '',
        "Comment Details": comment.feedback ?? '',
        "Comment Category": comment.response?.description ?? '',
        "Response Details": comment.responseDetails ?? ''
      }));

      const filename = `public-comments-${this.projectId}-${Date.now()}.csv`;

      CommonUtil.downloadCsvFromJson(exportRows, filename);

      this.exportSuccess = true;
      if (this.exportFeedbackTimeout) {
        clearTimeout(this.exportFeedbackTimeout);
      }
      this.exportFeedbackTimeout = setTimeout(() => {
        this.exportSuccess = false;
      }, 3000);
    } catch (err) {
      console.error('Failed to export comments.', err);
    } finally {
      this.exportInProgress = false;
    }
  }

  private formatCreateTimeForExport(createTimestamp?: string): string {
    if (!createTimestamp) {
      return '';
    }

    const parsedDate = new Date(createTimestamp);
    if (Number.isNaN(parsedDate.getTime())) {
      return '';
    }

    return this.exportDateTimeFormatter.format(parsedDate);
  }

  ngOnDestroy() {
    if (this.exportFeedbackTimeout) {
      clearTimeout(this.exportFeedbackTimeout);
    }
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}