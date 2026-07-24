import { ChangeDetectorRef, Component, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { PublicCommentCreateRequest, PublicCommentService, SpatialFeaturePublicResponse, SpatialObjectCodeEnum } from '@api-client';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { SpatialTypeMap } from '@public-core/constants/appConstants';
import { firstValueFrom } from 'rxjs';

enum COMMENT_SCOPE_CODE {
  OVERALL = 'OVERALL',
  CUT_BLOCK = 'CUT_BLOCK',
  ROAD_SECTION = 'ROAD_SECTION'
}

type CommentScopeOpt = {commentScopeCode: COMMENT_SCOPE_CODE,
                        desc: string,
                        name: string | null,
                        scopeId: number | null};

@Component({
  imports: [FormsModule, MatSelectModule, MatProgressBarModule],
  templateUrl: './comment-modal.component.html',
  styleUrl: './comment-modal.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class CommentModalComponent implements OnInit {
  activeModal = inject(NgbActiveModal);
  private commentService = inject(PublicCommentService);
  private changeDetectorRef = inject(ChangeDetectorRef);


  public submitting = false;
  public currentPage = 1;
  public publicComment = {} as PublicCommentCreateRequest;
  public iAgreeModel = false;
  public projectId: number;
  public projectSpatialDetail: SpatialFeaturePublicResponse[];
  public selectedScope: CommentScopeOpt;
  public commentScopeOpts :Array<CommentScopeOpt> = [];
  public feedbackLimit: number = 4000;

  ngOnInit(): void {
    this.publicComment.commentScopeCode = 'OVERALL';
    this.publicComment.projectId = this.projectId;

    // Comment Scope select options
    const overallOpt = {commentScopeCode: this.getCommentScopeCodeOrDesc(null, true) ?? COMMENT_SCOPE_CODE.OVERALL,
                        desc: this.getCommentScopeCodeOrDesc(null, false) ?? '',
                        name: null,
                        scopeId: null};
    this.selectedScope = overallOpt;
    this.commentScopeOpts.push(overallOpt);

    if (this.projectSpatialDetail) {
      this.projectSpatialDetail
        .filter((detail) => {
          return this.getCommentScopeCodeOrDesc(detail.featureType.code, true);// filter out rention_area.
        })
        .forEach((detail) => {
        this.commentScopeOpts.push({commentScopeCode: this.getCommentScopeCodeOrDesc(detail.featureType.code, true) ?? COMMENT_SCOPE_CODE.OVERALL,
                                desc: this.getCommentScopeCodeOrDesc(detail.featureType.code, false) ?? '',
                                name: detail.name,
                                scopeId: detail.featureId});
      });
    }
  }

  public dismiss(reason: string) {
    this.activeModal.dismiss(reason);
  }

  public p1_next() {
    this.currentPage++;
  }

  public p2_back() {
    this.currentPage--;
  }

  public p2_next() {
    this.currentPage++;
  }

  public p3_back() {
    this.currentPage--;
  }

  public async p3_next() {
    this.submitting = true;
    this.changeDetectorRef.detectChanges();
 
    this.publicComment.commentScopeCode = this.selectedScope.commentScopeCode;
    if (this.selectedScope.commentScopeCode === COMMENT_SCOPE_CODE.CUT_BLOCK) {
      // scopeId is always set for CUT_BLOCK/ROAD_SECTION options (built from a real feature's featureId)
      this.publicComment.scopeCutBlockId = this.selectedScope.scopeId!;
    }
    else if (this.selectedScope.commentScopeCode === COMMENT_SCOPE_CODE.ROAD_SECTION) {
      // scopeId is always set for CUT_BLOCK/ROAD_SECTION options (built from a real feature's featureId)
      this.publicComment.scopeRoadSectionId = this.selectedScope.scopeId!;
    }
 
    try {
      await firstValueFrom(this.commentService.publicCommentControllerCreate(this.publicComment));
      this.currentPage++;
      this.changeDetectorRef.detectChanges();
    } catch (err) {
      console.error(err);
      this.changeDetectorRef.detectChanges();
    } finally {
      this.submitting = false;
      this.changeDetectorRef.detectChanges();
    }
  }

  private getCommentScopeCodeOrDesc(source: string | null, forCode: true): COMMENT_SCOPE_CODE | null;
  private getCommentScopeCodeOrDesc(source: string | null, forCode: false): string | null;
  private getCommentScopeCodeOrDesc(source: string | null, forCode: boolean): COMMENT_SCOPE_CODE | string | null {
    switch(source) {
      case SpatialTypeMap.get(SpatialObjectCodeEnum.CutBlock)?.['source'].toLowerCase():
        return forCode? COMMENT_SCOPE_CODE.CUT_BLOCK: (SpatialTypeMap.get(SpatialObjectCodeEnum.CutBlock)?.['desc'] ?? null);

      case SpatialTypeMap.get(SpatialObjectCodeEnum.RoadSection)?.['source'].toLowerCase():
        return forCode? COMMENT_SCOPE_CODE.ROAD_SECTION: (SpatialTypeMap.get(SpatialObjectCodeEnum.RoadSection)?.['desc'] ?? null);

      case SpatialTypeMap.get(SpatialObjectCodeEnum.Wtra)?.['source'].toLowerCase():
        return null; // only can comment on CutBlock or RoadSection

      default:
        return forCode? COMMENT_SCOPE_CODE.OVERALL: 'Overall FOM';
    }
  }
}
