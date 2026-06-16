import { AuthGuard, UserHeader } from '@api-core/security/auth.guard';
import { Body, Controller, Delete, Get, HttpStatus, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from "@utility/security/user";
import { SpatialObjectCodeEnum, SubmissionDetailResponse, SubmissionRequest } from './submission.dto';
import { SubmissionService } from './submission.service';

@ApiTags('submission')
@UseGuards(AuthGuard)
@Controller('submission')
export class SubmissionController {
 
  constructor(private readonly service: SubmissionService) {}

  @Post()
  @ApiBearerAuth()
  @ApiBody({ type: SubmissionRequest })
  @ApiResponse({ status: HttpStatus.OK })
  async processSpatialSubmission(
    @UserHeader() user: User,
    @Body() dto: SubmissionRequest) {
    await this.service.processSpatialSubmission(dto, user);
  }

  @Get('/detail/:projectId')
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK, type: SubmissionDetailResponse })
  async findSubmissionDetailForCurrentSubmissionType(
    @UserHeader() user: User,
    @Param('projectId', ParseIntPipe) projectId: number): Promise<SubmissionDetailResponse | null> {
    return this.service.findSubmissionDetailForCurrentSubmissionType(projectId, user);
  }

  @Delete(':submissionId')
  @ApiBearerAuth()
  @ApiQuery({name: 'spatialObjectCode', type: 'string', enum: SpatialObjectCodeEnum})
  @ApiResponse({ status: HttpStatus.OK })
  async removeSpatialSubmissionByType(
    @UserHeader() user: User,
    @Param('submissionId', ParseIntPipe) submissionId: number,
    @Query('spatialObjectCode') spatialObjectCode: SpatialObjectCodeEnum) {
    return this.service.removeSubmissionBySpatialObjectType(submissionId, spatialObjectCode, user);
  }

}
