import {
  Controller,
  Get,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { AnalyticsDashboardService } from '@api-modules/analytics-dashboard/analytics-dashboard.service';
import { DateRangeRequest } from '@api-modules/analytics-dashboard/analytics-dashboard.dto';
import {
  ProjectCountByDistrictResponse,
  ProjectCountByForestClientResponse,
} from '@api-modules/project/project.dto';
import {
  PublicCommentCountByDistrictResponse,
  PublicCommentCountByCategoryResponse,
  PublicCommentCountByProjectResponse,
} from '@api-modules/public-comment/public-comment.dto';

@ApiTags('analytics-dashboard')
@Controller('analytics-dashboard')
export class AnalyticsDashboardController {
  constructor(private readonly dashboardService: AnalyticsDashboardService) {}

  /**
   * Returns the total number of FOM projects submitted
   * within the specified commenting open date range,
   * excluding those with an INITIAL workflow status.
   *
   * @param query - DateRangeRequest containing startDate and endDate in 'YYYY-MM-DD' format
   * @returns Number of FOM projects in the date range
   */
  @Get('project/count')
  @ApiOperation({
    summary: 'Get total number of FOMs submitted in a date range',
  })
  @ApiResponse({
    status: 200,
    description: 'Total number of FOMs',
    type: Number,
  })
  async getProjectCount(@Query() query: DateRangeRequest): Promise<number> {
    return this.dashboardService.getProjectCountByDate(
      query.startDate,
      query.endDate
    );
  }

  /**
   * Returns the number of FOM projects grouped by district
   * within the specified commenting open date range,
   * excluding those with an INITIAL workflow status.
   *
   * @param query - DateRangeRequest containing startDate and endDate in 'YYYY-MM-DD' format
   * @returns An array of objects containing districtId, districtName, and projectCount
   */
  @Get('project/count-by-district')
  @ApiOperation({
    summary: 'Get total number of FOMs grouped by district in a date range',
  })
  @ApiResponse({
    status: 200,
    description: 'List of FOM project counts by district',
    type: ProjectCountByDistrictResponse,
    isArray: true,
  })
  async getProjectCountByDistrict(
    @Query() query: DateRangeRequest
  ): Promise<ProjectCountByDistrictResponse[]> {
    return this.dashboardService.getProjectCountByDistrict(
      query.startDate,
      query.endDate
    );
  }

  /**
   * Returns the total number of unique forest clients who submitted FOMs
   * within the specified commenting open date range,
   * excluding those with an INITIAL workflow status,
   * and those with null forest client numbers.
   *
   * @param query - DateRangeRequest containing startDate and endDate in 'YYYY-MM-DD' format
   * @returns Number of distinct forest client numbers
   */
  @Get('project/forest-client/count')
  @ApiOperation({
    summary:
      'Get the number of unique forest clients who submitted FOMs in a date range',
  })
  @ApiResponse({
    status: 200,
    description: 'Total unique forest client count for submitted FOMs',
    type: Number,
  })
  async getUniqueForestClientCount(
    @Query() query: DateRangeRequest
  ): Promise<number> {
    return this.dashboardService.getUniqueForestClientCount(
      query.startDate,
      query.endDate
    );
  }

  /**
   * Returns the number of FOM projects submitted by each forest client
   * within the specified commenting open date range,
   * excluding those with an INITIAL workflow status.
   *
   * @param query - DateRangeRequest containing startDate and endDate in 'YYYY-MM-DD' format
   * @returns An array of objects containing forestClientNumber, forestClientName, projectCount
   */
  @Get('project/count-by-forest-client')
  @ApiOperation({
    summary:
      'Get total number of FOMs grouped by forest client numbers in a date range',
  })
  @ApiResponse({
    status: 200,
    description: 'List of FOM project counts by forest client numbers',
    type: ProjectCountByDistrictResponse,
    isArray: true,
  })
  async getProjectCountByForestClient(
    @Query() query: DateRangeRequest
  ): Promise<ProjectCountByForestClientResponse[]> {
    return this.dashboardService.getProjectCountByForestClient(
      query.startDate,
      query.endDate
    );
  }

  /**
   * Returns the number of public comments grouped by district within the specified date range.
   *
   * @param query - DateRangeRequest containing startDate and endDate in 'YYYY-MM-DD' format
   * @returns An array of objects containing districtId, districtName, and publicCommentCount
   */
  @Get('public-comment/count-by-district')
  @ApiOperation({
    summary:
      'Get total number of public comments grouped by district in a date range',
  })
  @ApiResponse({
    status: 200,
    description: 'List of comment counts by district',
    type: PublicCommentCountByDistrictResponse,
    isArray: true,
  })
  async getCommentCountByDistrict(
    @Query() query: DateRangeRequest
  ): Promise<PublicCommentCountByDistrictResponse[]> {
    return this.dashboardService.getCommentCountByDistrict(
      query.startDate,
      query.endDate
    );
  }

  /**
   * Returns the number of public comments grouped by response code (category)
   * within the specified date range.
   *
   * @param query - DateRangeRequest containing startDate and endDate in 'YYYY-MM-DD' format
   * @returns An array of objects containing responseCode and publicCommentCount
   */
  @Get('public-comment/count-by-responsecode')
  @ApiOperation({
    summary:
      'Get total number of public comments grouped by response code in a date range',
  })
  @ApiResponse({
    status: 200,
    description: 'List of comment counts by response code',
    type: PublicCommentCountByCategoryResponse,
    isArray: true,
  })
  async getCommentCountByResponseCode(
    @Query() query: DateRangeRequest
  ): Promise<PublicCommentCountByCategoryResponse[]> {
    return this.dashboardService.getCommentCountByResponseCode(
      query.startDate,
      query.endDate
    );
  }

  /**
   * Returns the top N most commented projects (FOMs) within the specified date range.
   *
   * @param query - DateRangeRequest containing startDate and endDate in 'YYYY-MM-DD' format
   * @param limit - Maximum number of projects to return
   * @returns An array of objects containing projectId, projectName, and publicCommentCount
   */
  @Get('public-comment/count-by-project')
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
    @Query() query: DateRangeRequest,
    @Query('limit', new DefaultValuePipe(15), ParseIntPipe) limit: number
  ): Promise<PublicCommentCountByProjectResponse[]> {
    return this.dashboardService.getTopCommentedProjects(
      query.startDate,
      query.endDate,
      limit
    );
  }
}
