import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpStatus, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as dayjs from 'dayjs';

import { UserHeader, UserRequiredHeader } from '@api-core/security/auth.service';
import { User } from "@utility/security/user";
import { PinoLogger } from 'nestjs-pino';
import { ProjectCommentClassificationMandatoryChangeRequest, ProjectCommentingClosedDateChangeRequest, ProjectCreateRequest, ProjectMetricsResponse, ProjectPublicSummaryResponse, ProjectResponse, ProjectUpdateRequest, ProjectWorkflowStateChangeRequest } from './project.dto';
import { ProjectFindCriteria, ProjectService } from './project.service';
import { WorkflowStateEnum } from './workflow-state-code.entity';


@ApiTags('project')
@Controller('project')
export class ProjectController {
  constructor(
    private readonly service: ProjectService,
    private readonly logger: PinoLogger) {
  }

  // Anonymous access allowed
  @Get('/publicSummary')
  @ApiQuery({ name: 'includeCommentOpen', required: false})
  @ApiQuery({ name: 'includePostCommentOpen', required: false})
  @ApiQuery({ name: 'forestClientName', required: false})
  @ApiQuery({ name: 'openedOnOrAfter', required: false})
  @ApiResponse({ status: HttpStatus.OK, type: [ProjectPublicSummaryResponse] })
  async findPublicSummary(
    @Query('includeCommentOpen') includeCommentOpen: string = 'true',
    @Query('includePostCommentOpen') includePostCommentOpen: string = 'true',
    @Query('forestClientName') forestClientName?: string,
    @Query('openedOnOrAfter') openedOnOrAfter?: string,
    ): Promise<ProjectPublicSummaryResponse[]> {

      const findCriteria: ProjectFindCriteria = new ProjectFindCriteria();

      if (forestClientName) {
        findCriteria.likeForestClientName = forestClientName;
      }

      if (includeCommentOpen == 'true') {
        findCriteria.includeWorkflowStateCodes.push(WorkflowStateEnum.COMMENT_OPEN);
      } 
      if (includePostCommentOpen == 'true') {
        findCriteria.includeWorkflowStateCodes.push(WorkflowStateEnum.COMMENT_CLOSED);
        findCriteria.includeWorkflowStateCodes.push(WorkflowStateEnum.FINALIZED);
        // Deliberately exclude EXPIRED
      }
      if (includeCommentOpen != 'true' && includePostCommentOpen != 'true') {
        throw new BadRequestException("Either includeCommentOpen or includePostCommentOpen must be true");
      }

      const DATE_FORMAT='YYYY-MM-DD';
      if (openedOnOrAfter) {
        findCriteria.commentingOpenedOnOrAfter = dayjs(openedOnOrAfter).format(DATE_FORMAT);
      } 

      this.logger.debug('get /project/publicSummary with criteria %o', findCriteria);

      return this.service.findPublicSummaries(findCriteria);
  }

  // Anonymous access allowed
  @Get(':id')
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK, type: ProjectResponse })
  async findOne(
    @UserHeader() user: User,
    @Param('id', ParseIntPipe) id: number): Promise<ProjectResponse> {
    return this.service.findOne(id, user, {
      relations: ['district', 'forestClient', 'workflowState'],
    });
  }

  @Get('/metrics/:id')
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK, type: ProjectMetricsResponse })
  async findProjectMetrics(
    @UserHeader() user: User,
    @Param('id', ParseIntPipe) id: number): Promise<ProjectMetricsResponse> {
    return this.service.findProjectMetrics(id, user);
  }

  @Get()
  @ApiBearerAuth()
  @ApiQuery({ name: 'fspId', required: false})
  @ApiQuery({ name: 'districtId', required: false})
  @ApiQuery({ name: 'workflowStateCode', required: false})
  @ApiQuery({ name: 'forestClientName', required: false})
  @ApiResponse({ status: HttpStatus.OK, type: [ProjectResponse] })
  async find(
    @UserRequiredHeader() user: User,
    @Query('fspId') fspId?: string,
    @Query('districtId') districtId?: string,
    @Query('workflowStateCode') workflowStateCode?: string,
    @Query('forestClientName') forestClientName?: string,
    ): Promise<ProjectResponse[]> {

      const findCriteria: ProjectFindCriteria = new ProjectFindCriteria();

      if (fspId) {
        findCriteria.fspId = await new ParseIntPipe().transform(fspId, null);
      }
      if (districtId) {
        findCriteria.districtId = await new ParseIntPipe().transform(districtId, null);
      }
      if (workflowStateCode) {
        findCriteria.includeWorkflowStateCodes.push(workflowStateCode);
      }
      if (forestClientName) {
        findCriteria.likeForestClientName = forestClientName;
      }
      // Ministry users can access all projects, while forest client users can only access projects for forest clients they are authorized for.
      if (!user.isMinistry && user.isForestClient) {
        findCriteria.includeForestClientNumbers = user.clientIds;
      }
      if (!user.isAuthorizedForAdminSite()) {
        throw new ForbiddenException();
      }
      return this.service.find(findCriteria);
  }

  @Post()
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.CREATED, type: ProjectResponse })
  async create(
    @UserRequiredHeader() user: User,
    @Body() request: ProjectCreateRequest
    ): Promise<ProjectResponse> {
    return this.service.create(request, user);
  }

  @Put(':id')
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK, type: ProjectResponse })
  @ApiBody({ type: ProjectUpdateRequest })
  async update(
    @UserRequiredHeader() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() request: ProjectUpdateRequest
  ): Promise<ProjectResponse> {
    return this.service.update(id, request, user);
  }

  @Put('/workflowState/:id')
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK, type: ProjectResponse })
  @ApiBody({ type: ProjectWorkflowStateChangeRequest })
  async stateChange(
    @UserRequiredHeader() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() request: ProjectWorkflowStateChangeRequest
  ): Promise<ProjectResponse> {
    return this.service.workflowStateChange(id, request, user);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK })
  async remove(
    @UserRequiredHeader() user: User,
    @Param('id', ParseIntPipe) id: number) {
    this.service.delete(id, user);
  }

  @Put('/commentClassification/:id')
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK, type: ProjectResponse })
  @ApiBody({ type: ProjectCommentClassificationMandatoryChangeRequest })
  async commentClassificationMandatoryChange(
    @UserRequiredHeader() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() request: ProjectCommentClassificationMandatoryChangeRequest
  ): Promise<ProjectResponse> {
    return this.service.commentClassificationMandatoryChange(id, request, user);
  }

  @Put('/commentingClosedDate/:id')
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK})
  @ApiBody({ type: ProjectCommentingClosedDateChangeRequest })
  async commentingClosedDateChange(
    @UserRequiredHeader() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() request: ProjectCommentingClosedDateChangeRequest
  ): Promise<boolean> {
    return this.service.commentingClosedDateChange(id, request, user);
  }
}
