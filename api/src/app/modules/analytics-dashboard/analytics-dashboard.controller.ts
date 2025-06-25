import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AnalyticsDashboardService } from '@api-modules/analytics-dashboard/analytics-dashboard.service';
import { DateRangeRequest } from '@api-modules/analytics-dashboard/analytics-dashboard.dto';
import { ProjectCountByDistrictResponse } from '@api-modules/project/project.dto';
import { PublicCommentCountByDistrictResponse } from '@api-modules/public-comment/public-comment.dto';

@ApiTags('dashboard')
@Controller('dashboard')
export class AnalyticsDashboardController {
  constructor(private readonly dashboardService: AnalyticsDashboardService) {}

  /**
   * Returns the total number of FOM projects submitted within a specified date range,
   * excluding those with an INITIAL workflow status.
   * @param query - DateRangeRequest containing startDate and endDate in 'YYYY-MM-DD' format
   * @returns Number of FOM projects in the date range
   */
  @Get('total-fom-count')
  @ApiOperation({
    summary: 'Get total number of FOMs submitted within a date range',
  })
  @ApiResponse({
    status: 200,
    description: 'Total number of FOMs',
    type: Number,
  })
  async getTotalFoms(@Query() query: DateRangeRequest): Promise<number> {
    return this.dashboardService.getProjectCountByDate(
      query.startDate,
      query.endDate
    );
  }

  /**
   * Returns the number of FOM projects grouped by district within a specified date range,
   * excluding those with an INITIAL workflow status.
   * @param query - DateRangeRequest containing startDate and endDate in 'YYYY-MM-DD' format
   * @returns An array of objects containing districtId, districtName, and projectCount.
   */
  @Get('fom-count-by-district')
  @ApiOperation({
    summary: 'Get total number of FOMs grouped by district within a date range',
  })
  @ApiResponse({
    status: 200,
    description: 'List of FOM project counts by district',
    type: ProjectCountByDistrictResponse,
    isArray: true,
  })
  async getFomCountByDistrict(
    @Query() query: DateRangeRequest
  ): Promise<ProjectCountByDistrictResponse[]> {
    return this.dashboardService.getProjectCountByDistrict(
      query.startDate,
      query.endDate
    );
  }

  /**
   * Retrieves the total number of public comments grouped by district
   * within the specified date range, excluding those with an INITIAL workflow status.
   * @param query - DateRangeRequest containing startDate and endDate in 'YYYY-MM-DD' format
   * @returns An array of objects containing district ID, district name, and publicCommentCount.
   */
  @Get('comment-count-by-district')
  @ApiOperation({
    summary:
      'Get total number of public comments grouped by district within a date range',
  })
  @ApiResponse({
    status: 200,
    description: 'List of comment counts by district',
    type: [PublicCommentCountByDistrictResponse],
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
}
