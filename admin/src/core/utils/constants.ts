import { SpatialObjectCodeEnum } from '@api-client';

export const MAX_FILEUPLOAD_SIZE = { // as MB
  SPATIAL: 30,
  DOCUMENT: 30
};

export enum COMMENT_SCOPE_CODE {
  OVERALL = 'OVERALL',
  CUT_BLOCK = 'CUT_BLOCK',
  ROAD_SECTION = 'ROAD_SECTION'
}

export type CommentScopeOpt = {
  commentScopeCode: COMMENT_SCOPE_CODE | null,
  desc: string,
  name: string | null,
  scopeId: number | null
};

export interface SpatialObjectType {
  source: string;
  type: string;
  desc: string;
}

export const SpatialTypeMap = new Map<SpatialObjectCodeEnum, SpatialObjectType>([
  [SpatialObjectCodeEnum.CutBlock, {
    source: 'cut_block',
    type: 'Polygon',
    desc: 'Cut Block'
  }],
  [SpatialObjectCodeEnum.RoadSection, {
    source: 'road_section',
    type: 'LineString',
    desc: 'Road Section'
  }],
  [SpatialObjectCodeEnum.Wtra, {
    source: 'retention_area',
    type: 'Polygon',
    desc: 'Retention Area'
  }],
]);

export const PROJECT_ID_PARAM_KEY: string = 'appId';
export const BC_TIME_ZONE = 'America/Vancouver';

export const DEFAULT_ISO_DATE_FORMAT = "yyyy-MM-dd";
export const FOM_GO_LIVE_DATE = '2024-04-01';
export const ANALYTICS_DATA_DEFAULT_SIZE = 15;
