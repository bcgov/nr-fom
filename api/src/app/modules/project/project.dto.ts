import { DateTimeUtil } from '@api-core/dateTimeUtil';
import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { ProjectPlanCodeEnum } from '@src/app/modules/project/project-plan-code.entity';
import {
    IsAlphanumeric,
    IsBoolean, IsDateString, IsEnum, IsNumber, IsNumberString, IsOptional, Matches, MaxLength,
    Min,
    MinLength,
    registerDecorator,
    ValidateIf,
    ValidationArguments, ValidationOptions
} from 'class-validator';
import { Point } from 'geojson';
import { DistrictResponse } from '../district/district.dto';
import { ForestClientResponse } from '../forest-client/forest-client.dto';
import { WorkflowStateCode, WorkflowStateEnum } from './workflow-state-code.entity';

export class ProjectCreateRequest {

  @ApiProperty()
  @MaxLength(50) 
  @MinLength(5) 
  name: string;

  @ApiProperty()
  @MaxLength(500) 
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'ISO-formatted date'})
  @IsOptional()
  @IsDateString()
  commentingOpenDate?: string;

  @ApiProperty({ description: 'ISO-formatted date'})
  @IsOptional()
  @IsDateString()
  commentingClosedDate?: string; 

  @ApiProperty()
  @IsNumberString()
  forestClientNumber: string;

  @ApiProperty({ 
    required: true, 
    enum: ProjectPlanCodeEnum, 
    enumName: 'ProjectPlanCodeEnum'
  })
  @IsEnum(ProjectPlanCodeEnum)
  projectPlanCode: ProjectPlanCodeEnum

  @ApiProperty()
  @ValidateIf(o => o.projectPlan as ProjectPlanCodeEnum === ProjectPlanCodeEnum.FSP) // validate when projectPlan is FSP
  @IsNumber()
  fspId?: number;

  @ApiProperty()
  @ValidateIf(o => o.projectPlan as ProjectPlanCodeEnum === ProjectPlanCodeEnum.WOODLOT) // validate when projectPlan is WOODLOT
  @MinLength(5)
  @MaxLength(5)
  @IsAlphanumeric()
  @Matches(/^W\d{4}/) // woodlot number regular expression. (W followed by 4 numbers).
  woodlotLicenseNumber?: string;

  @ApiProperty()
  @IsNumber()
  districtId: number;

  @ApiProperty({ required: true })
  @IsNumber()
  @Min(DateTimeUtil.now(DateTimeUtil.TIMEZONE_VANCOUVER).year())
  operationStartYear: number;

  @ApiProperty({ required: true })
  @IsNumber()
  @IsGreaterOrEqualTo('operationStartYear', {
    message: "Must be equal to or later than the Start of Operations",
  })
  operationEndYear: number;

  @ApiProperty()
  @ValidateIf(o => o.bctsMgrName && o.bctsMgrName.length > 0) // validate when not empty.
  @MinLength(3)
  @MaxLength(50)
  bctsMgrName?: string;
}

export class ProjectUpdateRequest extends OmitType(PartialType(ProjectCreateRequest), ['forestClientNumber']) {
  // forestClientNumber is the basis for security controls so cannot be changed on updates.
  // workflow state can only be changed via special requests, not via a project update request.

  @ApiProperty()
  @IsNumber()
  revisionCount: number;
}

export class ProjectWorkflowStateChangeRequest {
  @ApiProperty()
  @IsNumber()
  revisionCount: number;

  @ApiProperty({enum: WorkflowStateEnum, enumName: 'WorkflowStateEnum'})
  @IsEnum(WorkflowStateEnum)
  workflowStateCode: string;
}

// DTO optimized for Public FE map view
export class ProjectPublicSummaryResponse {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty({example: ` { "type": "Point", "coordinates": [-119.396071939, 49.813816629]}`})
  geojson: FomPoint;

  @ApiProperty()
  projectPlanCode: string
  
  @ApiPropertyOptional()
  fspId: number;

  @ApiPropertyOptional()
  woodlotLicenseNumber?: string;

  @ApiProperty()
  forestClientName: string;

  @ApiProperty()
  workflowStateName: string;

}

export class ProjectResponse {

  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ description: 'ISO-formatted date'})
  commentingOpenDate: string;

  @ApiProperty({ description: 'ISO-formatted date'})
  commentingClosedDate: string; 

  @ApiProperty({ description: 'ISO-formatted date'})
  validityEndDate: string

  @ApiProperty()
  projectPlanCode: string

  @ApiPropertyOptional()
  fspId?: number;

  @ApiPropertyOptional()
  woodlotLicenseNumber?: string;

  @ApiProperty()
  district: DistrictResponse;

  @ApiProperty()
  forestClient: ForestClientResponse;

  @ApiProperty()
  workflowState: WorkflowStateCode;

  @ApiProperty()
  revisionCount: number;

  @ApiProperty({ description: 'ISO-formatted timestamp'})
  createTimestamp: string;

  @ApiProperty({default: true})
  commentClassificationMandatory: boolean;

  @ApiProperty()
  publicNoticeId: number; // Online Public Notice (if any)

  @ApiProperty()
  noticePostDate?: string;

  @ApiProperty({ required: true })
  operationStartYear: number;

  @ApiProperty({ required: true })
  operationEndYear: number;

  @ApiProperty()
  bctsMgrName: string;
}

export class ProjectMetricsResponse {

  @ApiProperty()
  id: number;

  @ApiProperty()
  totalInteractionsCount: number;

  @ApiProperty()
  totalCommentsCount: number;

  @ApiProperty()
  respondedToCommentsCount: number;
}

// Need to do this to get to compile, rather than using Point directly. Not sure why...
export interface FomPoint extends Point {

}
export class ProjectCommentClassificationMandatoryChangeRequest {
    @ApiProperty()
    @IsBoolean()
    commentClassificationMandatory: boolean;
  
    @ApiProperty()
    @IsNumber()
    revisionCount: number;
}

export class ProjectCommentingClosedDateChangeRequest {
  @ApiProperty({ description: 'ISO-formatted date'})
  @IsDateString()
  commentingClosedDate: string;

  @ApiProperty()
  @IsNumber()
  revisionCount: number;
}

export class ProjectCountByDistrictResponse {
  @ApiProperty()
  districtId: number;

  @ApiProperty()
  districtName: string;

  @ApiProperty()
  projectCount: number;
}

/**
* Custom validation decorator: @IsGreaterOrEqualTo - check number_1 >= number_2
*/
export function IsGreaterOrEqualTo(property: string, validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isGreaterOrEqualTo',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          const relatedValue = (args.object as any)[relatedPropertyName];
          return typeof value === 'number' 
              && typeof relatedValue === 'number' 
              && value >= relatedValue;
        },
      },
    });
  };
}