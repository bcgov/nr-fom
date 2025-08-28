import { AdminOperationGuard } from '@api-core/security/admin.guard';
import { AuthGuard } from '@api-core/security/auth.guard';
import { AnalyticsDashboarQuaryRequest as AnalyticsRequestQuaryParams } from '@api-modules/analytics-dashboard/analytics-dashboard.dto';
import {
    ProjectCountByDistrictResponse,
    ProjectCountByForestClientResponse,
} from '@api-modules/project/project.dto';
import { ProjectService } from '@api-modules/project/project.service';
import {
    PublicCommentCountByCategoryResponse,
    PublicCommentCountByDistrictResponse,
    PublicCommentCountByForestClientResponse,
    PublicCommentCountByProjectResponse,
} from '@api-modules/public-comment/public-comment.dto';
import { PublicCommentService } from '@api-modules/public-comment/public-comment.service';
import {
    Controller,
    DefaultValuePipe,
    Get,
    ParseIntPipe,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { PinoLogger } from 'nestjs-pino';

@ApiTags('analytics-dashboard')
@UseGuards(AuthGuard, AdminOperationGuard)
@Controller('analytics-dashboard')
@ApiBearerAuth()
export class AnalyticsDashboardController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly publicCommentService: PublicCommentService,
    private readonly logger: PinoLogger
  ) {}

  /**
   * Returns the total number of FOM projects,
   * with a commenting open date within the specified date range,
   * excluding those with an INITIAL workflow status.
   *
   * @param query - AnalyticsRequestQuaryParams containing startDate and endDate in 'YYYY-MM-DD' format and projectPlanCode
   * @returns Number of non-Initial FOMs projects published in the date range
   */
  @Get('project/count')
  @ApiOperation({
    summary:
      'Get total number of non-initial FOMs published in a user selected date range',
  })
  @ApiResponse({
    status: 200,
    description:
      'Number of non-Initial FOMs projects published in the date range',
    type: Number,
  })
  async getNonInitialPublishedProjectCount(
    @Query() query: AnalyticsRequestQuaryParams
  ): Promise<number> {
    this.logger.debug(`Controller 'getNonInitialPublishedProjectCount' called with params ${JSON.stringify(query)}`)
    return this.projectService.getNonInitialPublishedProjectCount(
      query.startDate, query.endDate, query.projectPlanCode
    );
  }

  /**
   * Returns the number of FOM projects grouped by district,
   * with a commenting open date within the specified date range,
   * excluding those with an INITIAL workflow status.
   *
   * @param query - AnalyticsRequestQuaryParams containing startDate and endDate in 'YYYY-MM-DD' format and projectPlanCode
   * @returns An array of objects containing districtId, districtName, and projectCount
   */
  @Get('project/count-by-district')
  @ApiOperation({
    summary:
      'Get number of non-initial FOMs published in a user selected date range, grouped by district',
  })
  @ApiResponse({
    status: 200,
    description: 'List of non-initial FOM project counts by district',
    type: ProjectCountByDistrictResponse,
    isArray: true,
  })
  async getNonInitialPublishedProjectCountByDistrict(
    @Query() query: AnalyticsRequestQuaryParams
  ): Promise<ProjectCountByDistrictResponse[]> {
    this.logger.debug(`Controller 'getNonInitialPublishedProjectCountByDistrict' called with params ${JSON.stringify(query)}`)
    return this.projectService.getNonInitialPublishedProjectCountByDistrict(
      query.startDate, query.endDate, query.projectPlanCode
    );
  }

  /**
   * Returns the total number of unique forest clients who published FOMs
   * with a commenting open date within the specified range,
   * excluding those with an INITIAL workflow status.
   *
   * @param query - AnalyticsRequestQuaryParams containing startDate and endDate in 'YYYY-MM-DD' format and projectPlanCode
   * @returns Number of distinct forest client numbers
   */
  @Get('project/count-forest-client')
  @ApiOperation({
    summary:
      'Get total number of unique forest clients who published FOMs in a user selected date range',
  })
  @ApiResponse({
    status: 200,
    description: 'Total unique forest client count for published FOMs',
    type: Number,
  })
  async getUniqueForestClientCount(
    @Query() query: AnalyticsRequestQuaryParams
  ): Promise<number> {
    this.logger.debug(`Controller 'getUniqueForestClientCount' called with params ${JSON.stringify(query)}`);
    return this.projectService.getUniqueForestClientCount(
      query.startDate,
      query.endDate,
      query.projectPlanCode
    );
  }

  /**
   * Returns the number of FOM projects grouped by forest client
   * with a commenting open date within the specified date range,
   * excluding those with an INITIAL workflow status.
   *
   * @param query - AnalyticsRequestQuaryParams containing startDate and endDate in 'YYYY-MM-DD' format and projectPlanCode
   * @returns An array of objects containing forestClientNumber, forestClientName, projectCount
   */
  @Get('project/count-by-forest-client')
  @ApiOperation({
    summary:
      'Get number of non-initial FOMs published in a user selected date range, grouped by forest client numbers',
  })
  @ApiResponse({
    status: 200,
    description:
      'List of non-initial FOM project counts by forest client numbers',
    type: ProjectCountByForestClientResponse,
    isArray: true,
  })
  async getNonInitialPublishedProjectCountByForestClient(
    @Query() query: AnalyticsRequestQuaryParams
  ): Promise<ProjectCountByForestClientResponse[]> {
    this.logger.debug(`Controller 'getNonInitialPublishedProjectCountByForestClient' called with params ${JSON.stringify(query)}`);
    return this.projectService.getNonInitialPublishedProjectCountByForestClient(
      query.startDate,
      query.endDate,
      query.projectPlanCode
    );
  }

  /**
   * Returns the number of public comments grouped by district
   * with a create timestamp within the specified date range.
   *
   * @param query - AnalyticsRequestQuaryParams containing startDate and endDate in 'YYYY-MM-DD' format and projectPlanCode
   * @returns An array of objects containing districtId, districtName, and publicCommentCount
   */
  @Get('public-comment/count-by-district')
  @ApiOperation({
    summary:
      'Get number of public comments created in a user selected date range, grouped by district',
  })
  @ApiResponse({
    status: 200,
    description: 'List of comment counts by district',
    type: PublicCommentCountByDistrictResponse,
    isArray: true,
  })
  async getCommentCountByDistrict(
    @Query() query: AnalyticsRequestQuaryParams
  ): Promise<PublicCommentCountByDistrictResponse[]> {
    this.logger.debug(`Controller 'getCommentCountByDistrict' called with params ${JSON.stringify(query)}`);
    return this.publicCommentService.getCommentCountByDistrict(
      query.startDate,
      query.endDate,
      query.projectPlanCode
    );
  }

  /**
   * Returns the number of public comments grouped by forest clients
   * with a create timestamp within the specified date range.
   *
   * @param query - AnalyticsRequestQuaryParams containing startDate and endDate in 'YYYY-MM-DD' format and projectPlanCode
   * @returns An array of objects containing forestClientNumber, forestClientName, and publicCommentCount
   */
  @Get('public-comment/count-by-forest-client')
  @ApiOperation({
    summary:
      'Get number of public comments created in a user selected date range, grouped by forest clients',
  })
    @ApiResponse({
    status: 200,
    description: 'List of comment counts by forest clients',
    type: PublicCommentCountByForestClientResponse,
    isArray: true,
  })
  async getCommentCountByForestClient(
    @Query() query: AnalyticsRequestQuaryParams
  ): Promise<PublicCommentCountByForestClientResponse[]> {
    this.logger.debug(`Controller 'getCommentCountByForestClient' called with params ${JSON.stringify(query)}`);
    return this.publicCommentService.getCommentCountByForestClient(
      query.startDate,
      query.endDate,
      query.projectPlanCode
    );
  }

  /**
   * Returns the number of public comments grouped by response code (category)
   * with a create timestamp within the specified date range.
   *
   * @param query - AnalyticsRequestQuaryParams containing startDate and endDate in 'YYYY-MM-DD' format and projectPlanCode
   * @returns An array of objects containing responseCode and publicCommentCount
   */
  @Get('public-comment/count-by-responsecode')
  @ApiOperation({
    summary:
      'Get number of public comments created in a user selected date range, grouped by response code',
  })
  @ApiResponse({
    status: 200,
    description: 'List of comment counts by response code',
    type: PublicCommentCountByCategoryResponse,
    isArray: true,
  })
  async getCommentCountByResponseCode(
    @Query() query: AnalyticsRequestQuaryParams
  ): Promise<PublicCommentCountByCategoryResponse[]> {
    this.logger.debug(`Controller 'getCommentCountByForestClient' called with params ${JSON.stringify(query)}`);
    return this.publicCommentService.getCommentCountByResponseCode(
      query.startDate,
      query.endDate,
      query.projectPlanCode
    );
  }

  /**
   * Returns the top N most commented projects (FOMs)
   * with a comment create timestamp within the specified date range
   *
   * @param query - AnalyticsRequestQuaryParams containing startDate and endDate in 'YYYY-MM-DD' format and projectPlanCode
   * @param limit - Maximum number of projects to return
   * @returns An array of objects containing projectId, projectName, and publicCommentCount
   */
  @Get('public-comment/most-commented-projects')
  @ApiOperation({ summary: 'Get the top N most commented projects (FOMs)' })
  @ApiResponse({
    status: 200,
    description: 'List of comment counts by project',
    type: PublicCommentCountByProjectResponse,
    isArray: true,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of projects to return (default: 15)',
  })
  async getTopCommentedProjects(
    @Query() query: AnalyticsRequestQuaryParams,
    @Query('limit', new DefaultValuePipe(15), ParseIntPipe) limit: number
  ): Promise<PublicCommentCountByProjectResponse[]> {
    this.logger.debug(`Controller 'getTopCommentedProjects' called with params ${JSON.stringify(query)} and limit ${limit}`);
    return this.publicCommentService.getCommentCountByProject(
      query.startDate,
      query.endDate,
      query.projectPlanCode,
      limit
    );
  }
}
