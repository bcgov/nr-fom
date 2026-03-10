firstPage() {
  if (this.currentPage !== 1) {
    this.currentPage = 1;
    this.updatePage();
    this.selectedIds.clear();
  }
}

lastPage() {
  if (this.currentPage !== this.totalPages) {
    this.currentPage = this.totalPages;
    this.updatePage();
    this.selectedIds.clear();
  }
}
import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';

import { CognitoService } from "@admin-core/services/cognito.service";
import { StateService } from '@admin-core/services/state.service';
import { CommonUtil } from '@admin-core/utils/commonUtil';
import { COMMENT_SCOPE_CODE, CommentScopeOpt } from '@admin-core/utils/constants';
import { DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import {
  ProjectResponse, ProjectService, PublicCommentAdminResponse,
  PublicCommentAdminUpdateRequest, PublicCommentService, ResponseCodeEnum, SpatialFeatureService
} from '@api-client';
import { User } from "@utility/security/user";
import { indexBy } from 'remeda';
import { takeUntil } from 'rxjs/operators';
import { CommentDetailComponent } from './comment-detail/comment-detail.component';
import { ProgressDashboardComponent } from './progress-dashboard/progress-dashboard.component';

export const PAGE_SIZE = 50;

/** Maps backend ResponseCodeEnum values to display labels. */
export const RESPONSE_DISPLAY: Record<string, string> = {
  CONSIDERED: 'Considered',
  ADDRESSED: 'Addressed',
  IRRELEVANT: 'Not Applicable',
};

@Component({
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    NgClass,
    RouterLink,
    MatFormFieldModule,
    MatSelectModule,
    FormsModule,
    NgFor,
    MatOptionModule,
    CommentDetailComponent,
    ProgressDashboardComponent,
    DatePipe,
  ],
  selector: 'app-review-comments',
  templateUrl: './review-comments.component.html',
  styleUrls: [ './review-comments.component.scss' ]
})
export class ReviewCommentsComponent implements OnInit, OnDestroy {
  // ...existing code...

  firstPage() {
    if (this.currentPage !== 1) {
      this.currentPage = 1;
      this.updatePage();
      this.selectedIds.clear();
    }
  }

  lastPage() {
    if (this.currentPage !== this.totalPages) {
      this.currentPage = this.totalPages;
      this.updatePage();
      this.selectedIds.clear();
    }
  }

  @ViewChild('commentListScrollContainer', { read: ElementRef })
  public commentListScrollContainer: ElementRef;
  @ViewChild('commentDetailForm')
  commentDetailForm: CommentDetailComponent;

  public responseCodes = this.stateSvc.getCodeTable('responseCode');
  public commentScopeCodes = indexBy(this.stateSvc.getCodeTable('commentScopeCode'), (x) => x.code);
  public loading = false;
  public projectId: number;
  public project: ProjectResponse;
  public selectedItem: PublicCommentAdminResponse;
  public user: User;
  public commentScopeOpts: Array<CommentScopeOpt> = [];
  public selectedScope: CommentScopeOpt;

  /** Whether the mobile view is showing the detail pane (vs list). */
  public showDetailOnMobile = false;

  // ── raw data ──────────────────────────────────────────────────────────────
  public allComments: PublicCommentAdminResponse[] = [];

  // ── filter state ──────────────────────────────────────────────────────────
  public searchText = '';
  public selectedStatusFilter: string = 'ALL';
  public statusFilterOpts = [
    { value: 'ALL', label: 'All' },
    { value: 'UNACTIONED', label: 'Not Actioned' },
    { value: 'CONSIDERED', label: 'Considered' },
    { value: 'ADDRESSED', label: 'Addressed' },
    { value: 'IRRELEVANT', label: 'N/A' },
  ];

  getStatusCount(status: string): number {
    if (status === 'ALL') return this.allComments.length;
    if (status === 'UNACTIONED') return this.allComments.filter(c => !c.response?.code).length;
    return this.allComments.filter(c => c.response?.code === status).length;
  }

  // ── derived lists ─────────────────────────────────────────────────────────
  public filteredComments: PublicCommentAdminResponse[] = [];
  public pagedComments: PublicCommentAdminResponse[] = [];

  // ── pagination ────────────────────────────────────────────────────────────
  public currentPage = 1;
  public totalPages = 1;
  readonly pageSize = PAGE_SIZE;

  // ── bulk selection ────────────────────────────────────────────────────────
  public selectedIds = new Set<number>();
  public bulkStatus: ResponseCodeEnum = null;
  public bulkLoading = false;

  readonly RESPONSE_DISPLAY = RESPONSE_DISPLAY;

  private ngUnsubscribe: Subject<void> = new Subject<void>();

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
    this.projectId = this.route.snapshot.params.appId;
    this.projectSvc.projectControllerFindOne(this.projectId).toPromise()
      .then((result) => {
        this.project = result;
        // Sync form state now that authorization is known.
        if (this.commentDetailForm) {
          this.commentDetailForm.canReplyComment = this.canReplyComment();
        }
      });

    this.spatialFeatureService.spatialFeatureControllerGetForProject(this.projectId)
      .toPromise()
      .then((spatialDetails) => {
        this.commentScopeOpts = CommonUtil.buildCommentScopeOptions(spatialDetails);
        this.selectedScope = this.commentScopeOpts.filter(opt => opt.commentScopeCode == null)[ 0 ];
      });

    this.loadComments();
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  loadComments() {
    this.loading = true;
    this.commentSvc.publicCommentControllerFind(this.projectId)
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe({
        next: (comments) => {
          this.allComments = comments;
          this.loading = false;
          this.applyFilters();
        },
        error: (err) => {
          console.error('Failed to load comments.', err);
          this.loading = false;
        }
      });
  }

  // ── Filtering & Pagination ─────────────────────────────────────────────────

  applyFilters() {
    const search = this.searchText.trim().toLowerCase();
    const statusFilter = this.selectedStatusFilter;

    this.filteredComments = this.allComments.filter(c => {
      // scope filter
      const scope = this.selectedScope;
      if (scope && scope.commentScopeCode != null) {
        if (scope.commentScopeCode === COMMENT_SCOPE_CODE.OVERALL) {
          if (c.commentScope.code !== scope.commentScopeCode) return false;
        } else {
          if (c.commentScope.code !== scope.commentScopeCode) return false;
          if (!((c.scopeCutBlockId && c.scopeCutBlockId == scope.scopeId) ||
            (c.scopeRoadSectionId && c.scopeRoadSectionId == scope.scopeId))) return false;
        }
      }

      // status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'UNACTIONED') {
          if (c.response?.code) return false;
        } else {
          if (c.response?.code !== statusFilter) return false;
        }
      }

      // text search
      if (search) {
        const nameMatch = (c.name || '').toLowerCase().includes(search);
        const feedbackMatch = (c.feedback || '').toLowerCase().includes(search);
        if (!nameMatch && !feedbackMatch) return false;
      }

      return true;
    });

    this.totalPages = Math.max(1, Math.ceil(this.filteredComments.length / this.pageSize));
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
    this.updatePage();
    this.selectedIds.clear();
  }

  updatePage() {
    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedComments = this.filteredComments.slice(start, start + this.pageSize);
  }

  onScopeOptionChanged(_selection: CommentScopeOpt) {
    this.currentPage = 1;
    this.applyFilters();
  }

  onSearchChange() {
    this.currentPage = 1;
    this.applyFilters();
  }

  onStatusFilterChange() {
    this.currentPage = 1;
    this.applyFilters();
  }

  onDashboardFilter(status: string) {
    this.selectedStatusFilter = status;
    this.onStatusFilterChange();
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePage();
      this.selectedIds.clear();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePage();
      this.selectedIds.clear();
    }
  }

  // ── Selection ──────────────────────────────────────────────────────────────

  get allPageSelected(): boolean {
    return this.pagedComments.length > 0 &&
      this.pagedComments.every(c => this.selectedIds.has(c.id));
  }

  toggleSelectAll(checked: boolean) {
    if (checked) {
      this.pagedComments.forEach(c => this.selectedIds.add(c.id));
    } else {
      this.pagedComments.forEach(c => this.selectedIds.delete(c.id));
    }
  }

  toggleSelect(id: number, checked: boolean) {
    if (checked) {
      this.selectedIds.add(id);
    } else {
      this.selectedIds.delete(id);
    }
  }

  // ── Comment review interactions ────────────────────────────────────────────

  /**
   * @param item The comment to select.
   * @param pos Optional scroll position to restore after re-render.
   */
  onReviewItemClicked(item: PublicCommentAdminResponse, pos?: number) {
    this.selectedItem = item;
    this.commentDetailForm.selectedComment = item;
    // Explicitly sync — the @Input binding may not have fired yet if project is still loading.
    this.commentDetailForm.canReplyComment = this.canReplyComment();
    this.showDetailOnMobile = true;
    if (pos != null) {
      setTimeout(() => {
        this.commentListScrollContainer.nativeElement.scrollTop = pos;
      }, 150);
    }
  }

  backToList() {
    this.showDetailOnMobile = false;
  }

  /** Apply a status inline from the list row without opening detail. */
  async setInlineStatus(comment: PublicCommentAdminResponse, responseCode: ResponseCodeEnum, event: Event) {
    event.stopPropagation();
    if (!this.canReplyComment()) return;

    const update: PublicCommentAdminUpdateRequest = {
      responseCode,
      responseDetails: comment.responseDetails,
      revisionCount: comment.revisionCount,
    };
    try {
      const result = await this.commentSvc.publicCommentControllerUpdate(comment.id, update).toPromise();
      const idx = this.allComments.findIndex(c => c.id === comment.id);
      if (idx !== -1) this.allComments[ idx ] = result;
      this.allComments = [ ...this.allComments ]; // new reference triggers dashboard ngOnChanges
      if (this.selectedItem?.id === comment.id) {
        this.selectedItem = result;
        this.commentDetailForm.selectedComment = result;
      }
      this.applyFilters();
    } catch (err) {
      console.error('Failed to set inline status.', err);
    }
  }

  canReplyComment(): boolean {
    if (!this.project) return false;
    const userCanModify = this.user.isMinistry || this.user.isAuthorizedForClientId(this.project.forestClient.id);
    return userCanModify && (this.project.workflowState[ 'code' ] === 'COMMENT_OPEN'
      || this.project.workflowState[ 'code' ] === 'COMMENT_CLOSED');
  }

  async saveComment(update: PublicCommentAdminUpdateRequest, selectedComment: PublicCommentAdminResponse) {
    if (!this.canReplyComment()) return;

    const { id } = selectedComment;
    const pos = this.commentListScrollContainer?.nativeElement?.scrollTop ?? 0;

    try {
      this.loading = true;
      const result = await this.commentSvc.publicCommentControllerUpdate(id, update).toPromise();
      const idx = this.allComments.findIndex(c => c.id === id);
      if (idx !== -1) this.allComments[ idx ] = result;
      this.allComments = [ ...this.allComments ]; // new reference triggers dashboard ngOnChanges
      this.selectedItem = result;
      this.loading = false;
      this.applyFilters();
      setTimeout(() => this.onReviewItemClicked(this.selectedItem, pos), 300);
    } catch (err) {
      console.error('Failed to save comment.', err);
      this.loading = false;
    }
  }

  async saveCommentAndNext(update: PublicCommentAdminUpdateRequest, selectedComment: PublicCommentAdminResponse) {
    await this.saveComment(update, selectedComment);
    const currentIdx = this.filteredComments.findIndex(c => c.id === selectedComment.id);
    let nextUnactioned: PublicCommentAdminResponse | undefined;
    for (let i = currentIdx + 1; i < this.filteredComments.length; i++) {
      if (!this.filteredComments[ i ].response?.code) {
        nextUnactioned = this.filteredComments[ i ];
        break;
      }
    }
    // Optionally wrap to start if none found after current
    if (!nextUnactioned) {
      for (let i = 0; i < currentIdx; i++) {
        if (!this.filteredComments[ i ].response?.code) {
          nextUnactioned = this.filteredComments[ i ];
          break;
        }
      }
    }
    if (nextUnactioned) {
      this.onReviewItemClicked(nextUnactioned);
      // Ensure nextUnactioned is on the correct page.
      const idx = this.filteredComments.indexOf(nextUnactioned);
      const targetPage = Math.floor(idx / this.pageSize) + 1;
      if (targetPage !== this.currentPage) {
        this.currentPage = targetPage;
        this.updatePage();
      }
    }
  }

  // ── Bulk actions ───────────────────────────────────────────────────────────

  async applyBulkStatusBtn(status: ResponseCodeEnum) {
    if (!status || this.selectedIds.size === 0 || !this.canReplyComment()) return;
    this.bulkLoading = true;
    const ids = Array.from(this.selectedIds);
    for (const id of ids) {
      const comment = this.allComments.find(c => c.id === id);
      if (!comment) continue;
      const update: PublicCommentAdminUpdateRequest = {
        responseCode: status,
        responseDetails: comment.responseDetails,
        revisionCount: comment.revisionCount,
      };
      try {
        const result = await this.commentSvc.publicCommentControllerUpdate(id, update).toPromise();
        const idx = this.allComments.findIndex(c => c.id === id);
        if (idx !== -1) this.allComments[ idx ] = result;
        if (this.selectedItem?.id === id) {
          this.selectedItem = result;
          this.commentDetailForm.selectedComment = result;
        }
      } catch (err) {
        console.error(`Failed to update comment ${id}.`, err);
      }
    }
    this.allComments = [ ...this.allComments ]; // new reference triggers dashboard ngOnChanges
    this.bulkLoading = false;
    this.selectedIds.clear();
    this.bulkStatus = null;
    this.applyFilters();
  }

  clearBulkSelection() {
    this.selectedIds.clear();
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  @HostListener('document:keydown', [ '$event' ])
  onKeydown(event: KeyboardEvent) {
    const tag = (event.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if (!this.selectedItem || !this.canReplyComment()) {
      if (event.key === 'j' || event.key === 'J') this.navigateList(1);
      if (event.key === 'k' || event.key === 'K') this.navigateList(-1);
      return;
    }

    switch (event.key) {
      case 'c': case 'C': this.setInlineStatus(this.selectedItem, 'CONSIDERED', new MouseEvent('')); break;
      case 'a': case 'A': this.setInlineStatus(this.selectedItem, 'ADDRESSED', new MouseEvent('')); break;
      case 'n': case 'N': this.setInlineStatus(this.selectedItem, 'IRRELEVANT', new MouseEvent('')); break;
      case 'j': case 'J': this.navigateList(1); break;
      case 'k': case 'K': this.navigateList(-1); break;
    }
  }

  private navigateList(delta: number) {
    if (!this.filteredComments.length) return;
    const currentIdx = this.selectedItem
      ? this.filteredComments.findIndex(c => c.id === this.selectedItem.id)
      : -1;
    const nextIdx = Math.max(0, Math.min(this.filteredComments.length - 1, currentIdx + delta));
    const next = this.filteredComments[ nextIdx ];
    if (!next || next.id === this.selectedItem?.id) return;

    const targetPage = Math.floor(nextIdx / this.pageSize) + 1;
    if (targetPage !== this.currentPage) {
      this.currentPage = targetPage;
      this.updatePage();
    }
    this.onReviewItemClicked(next);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  responseLabel(comment: PublicCommentAdminResponse): string {
    const code = comment.response?.code;
    return code ? (RESPONSE_DISPLAY[ code ] ?? code) : 'Unactioned';
  }

  responseClass(comment: PublicCommentAdminResponse): string {
    const code = comment.response?.code;
    if (!code) return 'badge--unactioned';
    const map: Record<string, string> = {
      CONSIDERED: 'badge--considered',
      ADDRESSED: 'badge--addressed',
      IRRELEVANT: 'badge--not-applicable',
    };
    return map[ code ] ?? '';
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
