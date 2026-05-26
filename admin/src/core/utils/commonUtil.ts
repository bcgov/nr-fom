import { SpatialFeaturePublicResponse, SpatialObjectCodeEnum } from '@api-client';
import { json2csv, Json2CsvOptions } from 'json-2-csv';
import { COMMENT_SCOPE_CODE, CommentScopeOpt, SpatialTypeMap } from './constants';

export class CommonUtil {
  
  // Comment Scope select options
  static buildCommentScopeOptions(spatialDetails: SpatialFeaturePublicResponse[]): Array<CommentScopeOpt> {
    const commentScopeOpts = [];
    const allOpt = {commentScopeCode: null, desc: 'All', name: null, scopeId: null} as CommentScopeOpt;
    const overallOpt = {
      commentScopeCode: CommonUtil.getCommentScopeCodeOrDesc(null, true), 
      desc: CommonUtil.getCommentScopeCodeOrDesc(null, false), 
      name: null, 
      scopeId: null} as CommentScopeOpt;     
    commentScopeOpts.push(allOpt);
    commentScopeOpts.push(overallOpt);

    if (spatialDetails) {
      spatialDetails
        .filter((detail) => {
          return CommonUtil.getCommentScopeCodeOrDesc(detail.featureType.code, true);// filter out rention_area.
        })
        .forEach((detail) => {
        commentScopeOpts.push({commentScopeCode: CommonUtil.getCommentScopeCodeOrDesc(detail.featureType.code, true), 
                                desc: CommonUtil.getCommentScopeCodeOrDesc(detail.featureType.code, false),
                                name: detail.name, 
                                scopeId: detail.featureId} as CommentScopeOpt);
      });
    }
    return commentScopeOpts;
  }

  static getCommentScopeCodeOrDesc(source: string, forCode: boolean): COMMENT_SCOPE_CODE | string {
    const spatialTypeCutBlock = SpatialTypeMap.get(SpatialObjectCodeEnum.CutBlock);
    const spatialTypeRoadSection = SpatialTypeMap.get(SpatialObjectCodeEnum.RoadSection);
    const spatialTypeWtra = SpatialTypeMap.get(SpatialObjectCodeEnum.Wtra);
    switch(source) {
      case spatialTypeCutBlock['source'].toLowerCase():
        return forCode? COMMENT_SCOPE_CODE.CUT_BLOCK: spatialTypeCutBlock['desc'];

      case spatialTypeRoadSection['source'].toLowerCase():
        return forCode? COMMENT_SCOPE_CODE.ROAD_SECTION: spatialTypeRoadSection['desc'];

      case spatialTypeWtra['source'].toLowerCase():
        return null; // only can comment on CutBlock or RoadSection

      default:
        return forCode? COMMENT_SCOPE_CODE.OVERALL: 'Overall FOM';
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
