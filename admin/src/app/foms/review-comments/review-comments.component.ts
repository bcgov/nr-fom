import { Component, ElementRef, Injector, OnDestroy, OnInit, afterNextRender, computed, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { CognitoService } from "@admin-core/services/cognito.service";
import { LoadingService } from '@admin-core/services/loading.service';
import { ModalService } from '@admin-core/services/modal.service';
import { StateService } from '@admin-core/services/state.service';
import { CommonUtil } from '@admin-core/utils/commonUtil';
import { BC_TIME_ZONE, COMMENT_SCOPE_CODE, CommentScopeOpt } from '@admin-core/utils/constants';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import {
  PublicCommentAdminResponse,
  PublicCommentAdminUpdateRequest, PublicCommentService, SpatialFeatureService
} from '@api-client';
import { ProjectService } from '@api-client';
import { User } from "@utility/security/user";
import { indexBy } from 'remeda';
import { CommentDetailComponent } from './comment-detail/comment-detail.component';
import { ExportTermsModalComponent } from './export-terms-modal/export-terms-modal.component';

@Component({
    imports: [
    RouterLink,
    MatFormFieldModule,
    MatSelectModule,
    FormsModule,
    MatOptionModule,
    CommentDetailComponent,
    DatePipe
],
    selector: 'app-review-comments',
    templateUrl: './review-comments.component.html',
    styleUrl: './review-comments.component.scss'
})
export class ReviewCommentsComponent implements OnInit, OnDestroy {
  private commentSvc = inject(PublicCommentService);
  private stateSvc = inject(StateService);
  private projectSvc = inject(ProjectService);
  private spatialFeatureService = inject(SpatialFeatureService);
  private cognitoService = inject(CognitoService);
  private modalSvc = inject(ModalService);
  private injector = inject(Injector);
  loadingSvc = inject(LoadingService);

  readonly appId = input.required<string>();


  public readonly commentListScrollContainer = viewChild.required('commentListScrollContainer', { read: ElementRef });
  readonly commentDetailForm = viewChild.required<CommentDetailComponent>('commentDetailForm');

  public responseCodes = this.stateSvc.getCodeTable('responseCode')
  public commentScopeCodes = indexBy(this.stateSvc.getCodeTable('commentScopeCode'), (x) => x.code);
  public projectId!: number;
  public readonly selectedItem = signal<PublicCommentAdminResponse | null>(null);
  public user: User;

  public readonly exportInProgress = signal(false);
  public readonly exportSuccess = signal(false);
  private exportFeedbackTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly exportDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'long',
    timeZone: BC_TIME_ZONE
  });

  // FOM project (used by canReplyComment). Loaded reactively.
  private readonly projectResource = rxResource({
    params: () => Number(this.appId()),
    stream: ({ params }) => this.projectSvc.projectControllerFindOne(params),
  });
  readonly project = computed(() =>
    this.projectResource.hasValue() ? this.projectResource.value() : undefined);

  // Spatial features → comment-scope filter options. Loaded once.
  private readonly spatialResource = rxResource({
    params: () => Number(this.appId()),
    stream: ({ params }) => this.spatialFeatureService.spatialFeatureControllerGetForProject(params),
  });
  public readonly commentScopeOpts = computed<CommentScopeOpt[]>(() =>
    this.spatialResource.hasValue() ? CommonUtil.buildCommentScopeOptions(this.spatialResource.value()) : []);
  // Writable working copy: defaults to the "all scopes" option when options load, user can change it.
  public readonly selectedScope = linkedSignal<CommentScopeOpt>(
    () => this.commentScopeOpts().filter(opt => opt.commentScopeCode == null)[0]);

  // Public comments list. reload() after a save refetches it.
  private readonly commentsResource = rxResource({
    params: () => Number(this.appId()),
    stream: ({ params }) => this.commentSvc.publicCommentControllerFind(params),
  });
  public readonly allPublicComments = computed<PublicCommentAdminResponse[]>(() =>
    this.commentsResource.hasValue() ? (this.commentsResource.value() ?? []) : []);
  public readonly hasAnyPublicComments = computed(() => this.allPublicComments().length > 0);
  public readonly filteredPublicComments = computed<PublicCommentAdminResponse[]>(() =>
    this.filterProjectComments(this.allPublicComments(), this.selectedScope()));

  constructor() {
    this.user = this.cognitoService.getUser()!;
  }

  ngOnInit() {
    const commentListScrollContainer = this.commentListScrollContainer();
    if (commentListScrollContainer && commentListScrollContainer.nativeElement) {
      commentListScrollContainer.nativeElement.scrollTop = 0;
    }

    this.projectId = Number(this.appId());
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

  onScopeOptionChanged(selection: CommentScopeOpt) {
    this.selectedScope.set(selection);
  }

  /**
   * @param item item to be set to child component.
   * @param pos scroll position (from the list). When user clicks, no need to save it, only until user click 'save' then
   *            the saveComment() method will call this to update again the selected item and set selected item to child
   *            component and at the same time passing 'pos' to scroll to correct position for the list. Will need
   *            setTimeout to delay scrolling after view is good.
   */
  onReviewItemClicked(item: PublicCommentAdminResponse, pos: number | null) {
    this.selectedItem.set(item);
    if (pos) {
      // Restore the list scroll position after the selection re-render lands in the DOM.
      afterNextRender(() => {
        this.commentListScrollContainer().nativeElement.scrollTop = pos;
      }, { injector: this.injector });
    }
  }

  canReplyComment() {
    const project = this.project();
    if (!project) {
      return false;
    }
    const userCanModify = this.user.isAuthorizedForClientId(project.forestClient.id);
    return userCanModify && (project.workflowState['code'] === 'COMMENT_OPEN'
                            || project.workflowState['code'] === 'COMMENT_CLOSED');
  }

  async saveComment(update: PublicCommentAdminUpdateRequest, selectedComment: PublicCommentAdminResponse) {
    if (!this.canReplyComment()) {
      return;
    }
    const {id} = selectedComment;

    try {
      const result = await firstValueFrom(this.commentSvc.publicCommentControllerUpdate(id, update));

      // scroll position, important to get it first!!
      const pos = this.commentListScrollContainer().nativeElement.scrollTop;

      // Comment is saved successfully, so refetch the comment list from backend for a
      // consistent state of the list at frontend.
      this.commentsResource.reload();
      this.selectedItem.set(result); // updated selected.
      setTimeout(() => {
        const selected = this.selectedItem();
        if (selected) {
          this.onReviewItemClicked(selected, pos);
        }
      }, 300);

    } catch (err) {
      console.error("Failed to save comment.", err)
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
    if (!this.allPublicComments().length || this.exportInProgress()) {
      return;
    }

    this.exportInProgress.set(true);
    this.exportSuccess.set(false);

    try {
      const exportRows = this.allPublicComments().map((comment) => ({
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

      this.exportSuccess.set(true);
      if (this.exportFeedbackTimeout) {
        clearTimeout(this.exportFeedbackTimeout);
      }
      this.exportFeedbackTimeout = setTimeout(() => {
        this.exportSuccess.set(false);
      }, 3000);
    } catch (err) {
      console.error('Failed to export comments.', err);
    } finally {
      this.exportInProgress.set(false);
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
  }
}
