import { SpatialObjectCodeEnum } from "@api-client";

export const periodOperationsTxt = "This FOM can be relied upon by the FOM holder for the purpose of a cutting permit or road permit application, until the date three years after commencement of the public review and commenting period. FOMs published by BC Timber Sales can be relied upon for the purpose of a cutting permit or road permit application, or the issuance of a Timber Sales License until the date three years after conclusion of the public review and commenting period.";
export const woodlotOperationsTxt = "Woodlots are not legally required to publish FOMs for public review and comment prior to cutting permit or road permit application. However, woodlot licensees may choose to publish FOMs on a voluntary basis to facilitate public engagement.";

export const SpatialTypeMap = new Map<SpatialObjectCodeEnum, object>([
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

export const DELIMITER = {
  PIPE: '|'
}