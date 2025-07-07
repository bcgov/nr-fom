import { ApiProperty, OmitType } from '@nestjs/swagger';
import { ResponseCode, ResponseCodeEnum } from './response-code.entity';
import {
  CommentScopeCode,
  CommentScopeCodeEnum,
} from './comment-scope-code.entity';
import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PublicCommentCreateRequest {
  @ApiProperty()
  @IsNumber()
  projectId: number;

  @ApiProperty()
  @IsEnum(CommentScopeCodeEnum)
  commentScopeCode: string;

  @ApiProperty()
  @IsOptional()
  scopeCutBlockId?: number;

  @ApiProperty()
  @IsOptional()
  scopeRoadSectionId?: number;

  @ApiProperty()
  @MaxLength(4000) // Confirmed by business
  @MinLength(1)
  feedback: string;

  @ApiProperty()
  @MaxLength(50)
  @IsOptional()
  name?: string;

  @ApiProperty()
  @MaxLength(50)
  @IsOptional()
  location?: string;

  @ApiProperty()
  @IsOptional()
  @MaxLength(256) // Maximum allowed by Internet RFC.
  @IsEmail()
  email?: string;

  @ApiProperty()
  @MaxLength(50)
  @IsOptional()
  phoneNumber?: string;
}

export class PublicCommentAdminUpdateRequest {
  @ApiProperty()
  @IsNumber()
  revisionCount: number;

  @ApiProperty({ enum: ResponseCodeEnum, enumName: 'ResponseCodeEnum' })
  @IsEnum(ResponseCodeEnum)
  responseCode: string;

  @ApiProperty()
  @IsOptional()
  @MaxLength(4000)
  responseDetails?: string;
}

export class PublicCommentAdminResponse extends OmitType(
  PublicCommentCreateRequest,
  ['commentScopeCode']
) {
  @ApiProperty()
  id: number;

  @ApiProperty()
  revisionCount: number;

  @ApiProperty({ description: 'ISO-formatted timestamp' })
  createTimestamp: string;

  @ApiProperty()
  commentScope: CommentScopeCode;

  @ApiProperty()
  response?: ResponseCode;

  @ApiProperty()
  responseDetails?: string;

  @ApiProperty()
  scopeFeatureName?: string; //cutBlock.name or roadSection.name
}

export class PublicCommentCountByDistrictResponse {
  @ApiProperty()
  districtId: number;

  @ApiProperty()
  districtName: string;

  @ApiProperty()
  @IsNumber()
  publicCommentCount: number;
}

export class PublicCommentCountByCategoryResponse {
  @ApiProperty({
    oneOf: [
      { type: 'string', enum: Object.values(ResponseCodeEnum) },
      { type: 'string', enum: ['NOT_CATEGORIZED'] },
    ],
  })
  responseCode: string;

  @ApiProperty()
  @IsNumber()
  publicCommentCount: number;
}

export class PublicCommentCountByProjectResponse {
  @ApiProperty()
  projectId: string;

  @ApiProperty()
  projectName: string;

  @ApiProperty()
  @IsNumber()
  publicCommentCount: number;
}
