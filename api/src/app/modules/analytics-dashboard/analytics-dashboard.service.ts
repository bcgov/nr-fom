import { Injectable } from '@nestjs/common';
import {
  ProjectCountByDistrictResponse,
  ProjectCountByForestClientResponse,
} from '@api-modules/project/project.dto';
import { ProjectService } from '@api-modules/project/project.service';
import {
  PublicCommentCountByDistrictResponse,
  PublicCommentCountByCategoryResponse,
} from '@api-modules/public-comment/public-comment.dto';
import { PublicCommentService } from '@api-modules/public-comment/public-comment.service';

@Injectable()
export class AnalyticsDashboardService {
  constructor(
    private readonly projectService: ProjectService,
    private readonly publicCommentService: PublicCommentService
  ) {}

  async getProjectCountByDate(
    startDate: string,
    endDate: string
  ): Promise<number> {
    return this.projectService.getProjectCountByDate(startDate, endDate);
  }

  async getProjectCountByDistrict(
    startDate: string,
    endDate: string
  ): Promise<ProjectCountByDistrictResponse[]> {
    return this.projectService.getProjectCountByDistrict(startDate, endDate);
  }

  async getUniqueForestClientCount(
    startDate: string,
    endDate: string
  ): Promise<number> {
    return this.projectService.getUniqueForestClientCount(startDate, endDate);
  }

  async getProjectCountByForestClient(
    startDate: string,
    endDate: string
  ): Promise<ProjectCountByForestClientResponse[]> {
    return this.projectService.getProjectCountByForestClient(
      startDate,
      endDate
    );
  }

  async getCommentCountByDistrict(
    startDate: string,
    endDate: string
  ): Promise<PublicCommentCountByDistrictResponse[]> {
    return this.publicCommentService.getCommentCountByDistrict(
      startDate,
      endDate
    );
  }

  async getCommentCountByResponseCode(
    startDate: string,
    endDate: string
  ): Promise<PublicCommentCountByCategoryResponse[]> {
    return this.publicCommentService.getCommentCountByResponseCode(
      startDate,
      endDate
    );
  }
}
