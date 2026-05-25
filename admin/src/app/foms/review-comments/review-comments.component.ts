import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';

import { CognitoService } from "@admin-core/services/cognito.service";
import { StateService } from '@admin-core/services/state.service';
import { CommonUtil } from '@admin-core/utils/commonUtil';
import { COMMENT_SCOPE_CODE, CommentScopeOpt } from '@admin-core/utils/constants';
import { AsyncPipe, DatePipe, NgFor, NgIf } from '@angular/common';
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

export const ERROR_DIALOG = {
  width: '340px',
  height: '200px',
  buttons: {
    cancel: {
      text: 'Close'
    }
  }
};

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
        AsyncPipe, 
        DatePipe
    ],
    selector: 'app-review-comments',
    templateUrl: './review-comments.component.html',
    styleUrls: ['./review-comments.component.scss']
})
export class ReviewCommentsComponent implements OnInit, OnDestroy {

  @ViewChild('commentListScrollContainer', {read: ElementRef})
  public commentListScrollContainer: ElementRef;
  @ViewChild('commentDetailForm') 
  commentDetailForm: CommentDetailComponent;

  public responseCodes = this.stateSvc.getCodeTable('responseCode')
  public commentScopeCodes = indexBy(this.stateSvc.getCodeTable('commentScopeCode'), (x) => x.code);
  public loading = false;
  public projectId: number;
  public project: ProjectResponse;
  public selectedItem: PublicCommentAdminResponse;
  public user: User;
  public commentScopeOpts :Array<CommentScopeOpt> = [];
  public selectedScope: CommentScopeOpt;

  public allPublicComments: PublicCommentAdminResponse[] = [];
  public filteredPublicComments: PublicCommentAdminResponse[] = [];
  public hasAnyPublicComments = false;
  private ngUnsubscribe: Subject<void> = new Subject<void>();
  private triggered$ = new Subject<void>(); // To notify when 'save' or scope 'select' happen.

  constructor(
    private route: ActivatedRoute,
    private commentSvc: PublicCommentService,
    private stateSvc: StateService,
    private projectSvc: ProjectService,
    private spatialFeatureService: SpatialFeatureService,
    private cognitoService: CognitoService
  ) {
    this.user = this.cognitoService.getUser();
  }

  ngOnInit() {
    if (this.commentListScrollContainer && this.commentListScrollContainer.nativeElement) {
      this.commentListScrollContainer.nativeElement.scrollTop = 0;
    }
    
    this.projectId = this.route.snapshot.params.appId;
    this.projectSvc.projectControllerFindOne(this.projectId).toPromise()
        .then((result) => {this.project = result;});

    this.spatialFeatureService.spatialFeatureControllerGetForProject(this.projectId)
        .toPromise()
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
    this.commentDetailForm.selectedComment = item;
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
      const result = await this.commentSvc.publicCommentControllerUpdate(id, update).toPromise();

      // scroll position, important to get it first!!
      const pos = this.commentListScrollContainer.nativeElement.scrollTop;

      // Comment is saved successfully, so triggering service to retrieve comment list 
      // from backend for consistent state of the list at frontend.
      this.triggered$.next();
      this.selectedItem = result; // updated selected.
      this.loading = false;
      setTimeout(() => {
        this.onReviewItemClicked(this.selectedItem, pos);
      }, 300);

    } catch (err) {
      console.error("Failed to save comment.", err)
      this.loading = false;
    }
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}