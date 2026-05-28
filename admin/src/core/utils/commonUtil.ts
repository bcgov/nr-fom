import { SpatialFeaturePublicResponse, SpatialObjectCodeEnum } from '@api-client';
import { json2csv, Json2CsvOptions } from 'json-2-csv';
import { COMMENT_SCOPE_CODE, CommentScopeOpt, SpatialTypeMap } from './constants';

export class CommonUtil {
  private static getCommentScopeSpatialTypes() {
    return {
      cutBlock: SpatialTypeMap.get(SpatialObjectCodeEnum.CutBlock),
      roadSection: SpatialTypeMap.get(SpatialObjectCodeEnum.RoadSection),
      wtra: SpatialTypeMap.get(SpatialObjectCodeEnum.Wtra)
    };
  }
  
  // Comment Scope select options
  static buildCommentScopeOptions(spatialDetails: SpatialFeaturePublicResponse[]): Array<CommentScopeOpt> {
    const commentScopeOpts: CommentScopeOpt[] = [];
    // null commentScopeCode is used by the UI as the "show everything" selection.
    const allOpt: CommentScopeOpt = { commentScopeCode: null, desc: 'All', name: null, scopeId: null };
    // OVERALL is a valid scope code and should be distinct from the "All" filter option above.
    const overallOpt: CommentScopeOpt = {
      commentScopeCode: CommonUtil.getCommentScopeCode(null), 
      desc: CommonUtil.getCommentScopeDesc(null) ?? 'Overall FOM', 
      name: null, 
      scopeId: null
    };
    commentScopeOpts.push(allOpt);
    commentScopeOpts.push(overallOpt);

    if (spatialDetails) {
      spatialDetails.forEach((detail) => {
        const commentScopeCode = CommonUtil.getCommentScopeCode(detail.featureType.code);
        if (!commentScopeCode) {
          return; // Exclude feature types that are not commentable (e.g., retention_area).
        }

        const desc = CommonUtil.getCommentScopeDesc(detail.featureType.code);
        if (!desc) {
          return;
        }

        // Include scoped options tied to a specific feature id/name for filtering.
        commentScopeOpts.push({
          commentScopeCode,
          desc,
          name: detail.name,
          scopeId: detail.featureId
        });
      });
    }
    return commentScopeOpts;
  }

  static getCommentScopeCode(source: string | null): COMMENT_SCOPE_CODE | null {
    const spatialTypes = CommonUtil.getCommentScopeSpatialTypes();
    switch(source) {
      case spatialTypes.cutBlock?.source.toLowerCase():
        return COMMENT_SCOPE_CODE.CUT_BLOCK;

      case spatialTypes.roadSection?.source.toLowerCase():
        return COMMENT_SCOPE_CODE.ROAD_SECTION;

      case spatialTypes.wtra?.source.toLowerCase():
        return null; // only can comment on CutBlock or RoadSection

      default:
        return COMMENT_SCOPE_CODE.OVERALL;
    }
  }

  static getCommentScopeDesc(source: string | null): string | null {
    const spatialTypes = CommonUtil.getCommentScopeSpatialTypes();
    switch(source) {
      case spatialTypes.cutBlock?.source.toLowerCase():
        return spatialTypes.cutBlock!.desc;

      case spatialTypes.roadSection?.source.toLowerCase():
        return spatialTypes.roadSection!.desc;

      case spatialTypes.wtra?.source.toLowerCase():
        return null; // only can comment on CutBlock or RoadSection

      default:
        return 'Overall FOM';
    }
  }

  static downloadCsvFromJson(rows: object[], fileName: string, options?: Json2CsvOptions): void {
    const csv = json2csv(rows, {
      excelBOM: true,
      ...options
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const objectUrl = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.click();

    URL.revokeObjectURL(objectUrl);
  }
}
