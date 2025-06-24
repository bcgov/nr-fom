import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AnalyticsDashboardService } from './analytics-dashboard.service';
import { DateRangeQueryDto } from './analytics-dashboard.dto';
import { FOMCountByDistrictDto } from '@api-modules/project/project.dto';

@ApiTags('dashboard')
@Controller('dashboard')
export class AnalyticsDashboardController {
  constructor(private readonly dashboardService: AnalyticsDashboardService) {}

  /**
   * Returns the total number of FOM projects submitted within a specified date range,
   * excluding those with an INITIAL workflow status.
   * @param startDate - Start date string in YYYY-MM-DD format (required)
   * @param endDate - End date string in YYYY-MM-DD format (optional, defaults to today)
   * @returns Number of FOM projects in the date range
   */
  @Get('total-fom-count')
  @ApiOperation({ summary: 'Get total number of FOMs submitted in date range' })
  @ApiResponse({
    status: 200,
    description: 'Total number of FOMs',
    type: Number,
  })
  async getTotalFoms(@Query() query: DateRangeQueryDto): Promise<number> {
    return this.dashboardService.getFomCountByDate(
      query.startDate,
      query.endDate
    );
  }

  /**
   * Returns the number of FOM projects grouped by district within a specified date range,
   * excluding those with an INITIAL workflow status.
   * @param startDate - The start date (inclusive) in YYYY-MM-DD format. (Required)
   * @param endDate - The end date (inclusive) in YYYY-MM-DD format. (Optional, defaults to today)
   * @returns An array of objects containing districtId, districtName, and fomCount.
   */
  @Get('fom-count-by-district')
  @ApiOperation({
    summary: 'Get FOM count grouped by district within a date range',
  })
  @ApiResponse({
    status: 200,
    description: 'List of FOM project counts by district',
    type: FOMCountByDistrictDto,
    isArray: true,
  })
  async getFomCountByDistrict(
    @Query() query: DateRangeQueryDto
  ): Promise<FOMCountByDistrictDto[]> {
    return this.dashboardService.getFomCountByDistrict(
      query.startDate,
      query.endDate
    );
  }
}