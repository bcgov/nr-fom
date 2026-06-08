import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, MaxLength } from 'class-validator';
import { ProjectResponse } from './project.dto';
import { IsISODateOnlyString } from '@api-modules/interaction/interaction.dto';
import { DateTimeUtil } from '@api-core/dateTimeUtil';

export class PublicNoticeCreateRequest {

  @ApiProperty()
  @IsNumber()
  projectId!: number;

  @ApiProperty()
  @MaxLength(500) 
  reviewAddress!: string;

  @ApiProperty()
  @MaxLength(100) 
  reviewBusinessHours!: string;

  @ApiProperty()
  @MaxLength(500) 
  @IsOptional()
  receiveCommentsAddress!: string;

  @ApiProperty()
  @MaxLength(100) 
  @IsOptional()
  receiveCommentsBusinessHours!: string;

  @ApiProperty()
  @IsBoolean()
  isReceiveCommentsSameAsReview!: boolean;

  @ApiProperty()
  @MaxLength(100) 
  mailingAddress!: string;

  @ApiProperty()
  @MaxLength(100) 
  email!: string;

  @ApiProperty({ description: 'Date planed for online public notice posted.'})
  @IsOptional()
  @IsISODateOnlyString({message: `"$property" must be ISO-formatted date. (Required format: ${DateTimeUtil.DATE_FORMAT})`})
  postDate?: string; 
}

export class PublicNoticeUpdateRequest extends PublicNoticeCreateRequest {

  @ApiProperty()
  @IsNumber()
  revisionCount!: number;

}

export class PublicNoticeResponse extends PublicNoticeUpdateRequest {

  @ApiProperty()
  id!: number;

}

export class PublicNoticePublicFrontEndResponse extends PublicNoticeCreateRequest {

  @ApiProperty()
  project!: ProjectResponse;

}