import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { FeatureCollection } from 'geojson';
import { SubmissionTypeCodeEnum } from './submission-type-code.entity';

// Using GeoJSON types, won't have the API documentation but that's okay.
export interface FomSpatialJson extends FeatureCollection {
  crs?: { 
    type: "name", 
    // Only these formats/values (short/long) for supplied spatial submission are accepted.
    properties: { "name": "EPSG:3005" | "urn:ogc:def:crs:EPSG::3005" | 
                          "EPSG:4326" | "urn:ogc:def:crs:EPSG::4326" }
  }
}

export enum SpatialObjectCodeEnum {
  CUT_BLOCK = 'CUT_BLOCK',
  ROAD_SECTION = 'ROAD_SECTION',
  WTRA = 'WTRA'
}

export enum SpatialCoordSystemEnum {
  BC_ALBERS = 3005, //EPSG:3005
  WGS84 = 4326 // EPSG:4326
}

export class SubmissionRequest {
  @ApiProperty()
  @IsNotEmpty()
  projectId!: number;

  @ApiProperty({ enum: SubmissionTypeCodeEnum, enumName: 'SubmissionTypeCodeEnum'})
  @IsEnum(SubmissionTypeCodeEnum)
  submissionTypeCode!: SubmissionTypeCodeEnum;
  
  @ApiProperty({ enum: SpatialObjectCodeEnum, enumName: 'SpatialObjectCodeEnum'})
  @IsNotEmpty()
  @IsEnum(SpatialObjectCodeEnum)
  spatialObjectCode!: SpatialObjectCodeEnum;
  
  @ApiProperty()
  @IsNotEmpty()
  jsonSpatialSubmission!: FomSpatialJson;
}

/*
  Prevously this was defined as "export type SubmissionSpatialObjectDetail".
  And NestJS @ApiProperty cannot take Typescript "type" as "type" field as one configuration option.
  It has to be a 'value'.
  As the result, OpenAPI generator cannot generated best type for this response object and when frontend
  Angular component/template(html) refer to this object (with tsconfig.json => "strictTemplates": true),
  frontend compilation fail due to some "properties does not exist" (Typescript error).
  To address this problem, switch from "export type" to "export class".
  Issue tickets: https://github.com/bcgov/nr-fom/issues/158
                 https://github.com/bcgov/nr-fom/issues/146
*/
export class SubmissionSpatialObjectDetail {
    @ApiProperty()
    count!: number;

    @ApiProperty()
    dateSubmitted!: Date;
}

export class SubmissionDetailResponse {

  @ApiProperty()
  projectId!: number;

  @ApiProperty()
  submissionId!: number;

  @ApiProperty({ 
    enum: SubmissionTypeCodeEnum, 
    enumName: 'SubmissionTypeCodeEnum',
    example: SubmissionTypeCodeEnum.PROPOSED,
    default: SubmissionTypeCodeEnum.PROPOSED
  })
  submissionTypeCode!: SubmissionTypeCodeEnum;

  @ApiProperty({type: SubmissionSpatialObjectDetail})
  cutblocks!: SubmissionSpatialObjectDetail;

  @ApiProperty({type: SubmissionSpatialObjectDetail})
  roadSections!: SubmissionSpatialObjectDetail;

  @ApiProperty({type: SubmissionSpatialObjectDetail})
  retentionAreas!: SubmissionSpatialObjectDetail;
}
