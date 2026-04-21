import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { PublicCommentCreateRequest, PublicCommentService, SpatialFeaturePublicResponse, SpatialObjectCodeEnum } from '@api-client';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap/modal';
import { SpatialTypeMap } from '@public-core/constants/appConstants';

enum COMMENT_SCOPE_CODE {
  OVERALL = 'OVERALL',
  CUT_BLOCK = 'CUT_BLOCK',
  ROAD_SECTION = 'ROAD_SECTION'
}

type CommentScopeOpt = {commentScopeCode: COMMENT_SCOPE_CODE,
                        desc: string,
                        name: string, 
                        scopeId: number};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, MatSelectModule, MatProgressBarModule],
  templateUrl: './comment-modal.component.html',
  styleUrls: ['./comment-modal.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CommentModalComponent implements OnInit {

  public submitting = false;
  public currentPage = 1;
  public publicComment = {} as PublicCommentCreateRequest;
  public iAgreeModel = false;
  public projectId: number;
  public projectSpatialDetail: SpatialFeaturePublicResponse[];
  public selectedScope: CommentScopeOpt;
  public commentScopeOpts :Array<CommentScopeOpt> = [];
  public feedbackLimit: number = 4000;

  constructor(
    public activeModal: NgbActiveModal,
    private commentService: PublicCommentService
  ) {}

  ngOnInit(): void {
    this.publicComment.commentScopeCode = 'OVERALL';
    this.publicComment.projectId = this.projectId;

    // Comment Scope select options
    const overallOpt = {commentScopeCode: this.getCommentScopeCodeOrDesc(null, true), 
                        desc: this.getCommentScopeCodeOrDesc(null, false), 
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
        this.commentScopeOpts.push({commentScopeCode: this.getCommentScopeCodeOrDesc(detail.featureType.code, true), 
                                desc: this.getCommentScopeCodeOrDesc(detail.featureType.code, false),
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

  public p3_next() {
    this.submitting = true;

    this.publicComment.commentScopeCode = this.selectedScope.commentScopeCode;
    if (this.selectedScope.commentScopeCode === COMMENT_SCOPE_CODE.CUT_BLOCK) {
      this.publicComment.scopeCutBlockId = this.selectedScope.scopeId;
    }
    else if (this.selectedScope.commentScopeCode === COMMENT_SCOPE_CODE.ROAD_SECTION) {
      this.publicComment.scopeRoadSectionId = this.selectedScope.scopeId;
    }

    this.commentService.publicCommentControllerCreate(this.publicComment)
        .toPromise()
        .then(() => {
          this.submitting = false;
          this.currentPage++;
        })
        .catch((err) => {
          console.error(err)
          this.submitting = false;
        });
  }

  private getCommentScopeCodeOrDesc(source: string, forCode: boolean) {
    switch(source) {
      case SpatialTypeMap.get(SpatialObjectCodeEnum.CutBlock)['source'].toLowerCase():
        return forCode? COMMENT_SCOPE_CODE.CUT_BLOCK: SpatialTypeMap.get(SpatialObjectCodeEnum.CutBlock)['desc'];

      case SpatialTypeMap.get(SpatialObjectCodeEnum.RoadSection)['source'].toLowerCase():
        return forCode? COMMENT_SCOPE_CODE.ROAD_SECTION: SpatialTypeMap.get(SpatialObjectCodeEnum.RoadSection)['desc'];

      case SpatialTypeMap.get(SpatialObjectCodeEnum.Wtra)['source'].toLowerCase():
        return null; // only can comment on CutBlock or RoadSection

      default:
        return forCode? COMMENT_SCOPE_CODE.OVERALL: 'Overall FOM';
    }
  }
}
