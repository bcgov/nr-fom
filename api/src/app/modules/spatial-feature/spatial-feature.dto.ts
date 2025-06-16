import { ApiProperty } from "@nestjs/swagger";
import { SubmissionTypeCode } from "../submission/submission-type-code.entity";
import { FeatureTypeCode } from "./feature-type-code";

export class SpatialFeaturePublicResponse {

    @ApiProperty()
    featureType: FeatureTypeCode;

    @ApiProperty()
    featureId: number;

    @ApiProperty()
    name: string;

    @ApiProperty({ description: 'Format: GeoJSON Geometry object' })
    geometry: object;

    @ApiProperty({ description: 'Format: GeoJSON Point' })
    centroid: object;

    @ApiProperty({ description: 'Format: YYYY-MM-DD'})
    plannedDevelopmentDate: string;
  
    @ApiProperty()
    plannedAreaHa: number;
  
    @ApiProperty()
    plannedLengthKm: number;

    @ApiProperty()
    submissionType: SubmissionTypeCode;    
 }

// Keep this BCGW API completely separated from the API used by FOM Public.
// More heavily documented to support use by third party.
export class SpatialFeatureBcgwResponse {

    @ApiProperty()
    fomId: number;

    @ApiProperty({ enum: ['cut_block', 'road_section', 'retention_area']})
    featureType: string;

    @ApiProperty()
    featureId: number;

    @ApiProperty({ description: 'Feature object name', example: 'My cut block 2311' })
    name: string;

    @ApiProperty({ description: 'Maximum length is expected to be <= 100'})
    fspHolderName: string;

    @ApiProperty({ enum: ['Proposed', 'Final']})
    lifecycleStatus: string;
  
    @ApiProperty({ description: 'Format: YYYY-MM-DD', example: '2021-03-31'})
    createDate: string;

    @ApiProperty({ description: 'Format: GeoJSON Geometry as per RFC 7946 https://datatracker.ietf.org/doc/html/rfc7946#section-3.1.', 
        example: 'Cut Block / Retention Area Example: {"type":"Polygon","coordinates":[[[-121.652853481,51.67951884],[-121.499131212,51.763467947],[-121.363845891,51.668139701],[-121.373301212,51.578595415],[-121.661722435,51.589952346],[-121.652853481,51.67951884]]]} Road Section Example: {"type":"LineString","coordinates":[[-124.667049923,52.651503193],[-124.739768473,52.697146151],[-124.816364174,52.60827305]]}'})
    geometry: object;

    @ApiProperty({ description: 'Format: YYYY-MM-DD', example: '2021-03-31'})
    plannedDevelopmentDate: string;
  
    @ApiProperty({ example: '1.2345'})
    plannedAreaHa: number;
  
    @ApiProperty({ example: '1.2345'})
    plannedLengthKm: number;
}