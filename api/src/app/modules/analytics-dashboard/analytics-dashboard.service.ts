import { Injectable } from '@nestjs/common';
import { FOMCountByDistrictDto } from '@api-modules/project/project.dto';
import { ProjectService } from '@api-modules/project/project.service';

@Injectable()
export class AnalyticsDashboardService {
  constructor(private readonly projectService: ProjectService) {}

  async getFomCountByDate(startDate: string, endDate: string): Promise<number> {
    return this.projectService.getFomCountByDate(startDate, endDate);
  }

  async getFomCountByDistrict(
    startDate: string,
    endDate: string
  ): Promise<FOMCountByDistrictDto[]> {
    return this.projectService.getFomCountByDistrict(startDate, endDate);
  }
}
