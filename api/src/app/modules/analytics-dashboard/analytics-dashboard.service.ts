import { Injectable } from '@nestjs/common';
import {
  ProjectCountByDistrictResponse,
  ProjectCountByForestClientResponse,
} from '@api-modules/project/project.dto';
import { ProjectService } from '@api-modules/project/project.service';
import {
  PublicCommentCountByDistrictResponse,
  PublicCommentCountByCategoryResponse,
  PublicCommentCountByProjectResponse,
} from '@api-modules/public-comment/public-comment.dto';
import { PublicCommentService } from '@api-modules/public-comment/public-comment.service';

@Injectable()
export class AnalyticsDashboardService {
  constructor(
    private readonly projectService: ProjectService,
    private readonly publicCommentService: PublicCommentService
  ) {}

  async getNonInitialProjectCountByDate(
    startDate: string,
    endDate: string
  ): Promise<number> {
    return this.projectService.getNonInitialProjectCountByDate(startDate, endDate);
  }

  async getNonInitialProjectCountByDistrict(
    startDate: string,
    endDate: string
  ): Promise<ProjectCountByDistrictResponse[]> {
    return this.projectService.getNonInitialProjectCountByDistrict(startDate, endDate);
  }

  async getUniqueForestClientCount(
    startDate: string,
    endDate: string
  ): Promise<number> {
    return this.projectService.getUniqueForestClientCount(startDate, endDate);
  }

  async getNonInitialProjectCountByForestClient(
    startDate: string,
    endDate: string
  ): Promise<ProjectCountByForestClientResponse[]> {
    return this.projectService.getNonInitialProjectCountByForestClient(
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

  async getTopCommentedProjects(
    startDate: string,
    endDate: string,
    limit: number
  ): Promise<PublicCommentCountByProjectResponse[]> {
    return this.publicCommentService.getCommentCountByProject(
      startDate,
      endDate,
      limit
    );
  }
}
