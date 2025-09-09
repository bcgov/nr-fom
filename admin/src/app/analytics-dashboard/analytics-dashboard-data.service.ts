import { ANALYTICS_DATA_DEFAULT_SIZE } from '@admin-core/utils/constants';
import { Injectable } from '@angular/core';
import { AnalyticsDashboardService, ProjectCountByDistrictResponse, ProjectCountByForestClientResponse, ProjectPlanCodeFilterEnum, PublicCommentCountByProjectResponse } from '@api-client';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export class ApiError {
  constructor(public message: any) {}
}

export type AnalyticsDashboardData = {
  nonInitialPublishedProjectCount: number | ApiError // Total FOM count
  commentCountByResponseCode: Record<string, number> | ApiError
  topCommentedProjects: Array<PublicCommentCountByProjectResponse> | ApiError
  nonInitialPublishedProjectCountByDistrict: Array<ProjectCountByDistrictResponse> | ApiError
  uniqueForestClientCount: number | ApiError
  nonInitialPublishedProjectCountByForestClient: Array<ProjectCountByForestClientResponse> | ApiError
}

@Injectable({ providedIn: 'root' })
export class AnalyticsDashboardDataService {
  constructor(private api: AnalyticsDashboardService) {}

  getAnalyticsData(
    startDate: string, endDate: string, 
    projectPlanCode: ProjectPlanCodeFilterEnum = ProjectPlanCodeFilterEnum.Fsp, 
    limit: number = ANALYTICS_DATA_DEFAULT_SIZE
  ) {
    return forkJoin({
      nonInitialPublishedProjectCount: this.api.analyticsDashboardControllerGetNonInitialPublishedProjectCount(startDate, endDate, projectPlanCode).pipe(
        catchError(err => this.handleApiError('nonInitialPublishedProjectCount', err))
      ),
      commentCountByResponseCode: this.api.analyticsDashboardControllerGetCommentCountByResponseCode(startDate, endDate, projectPlanCode).pipe(
        map(mapCommentCountByResponseCodeFn),
        catchError(err => this.handleApiError('commentCountByResponseCode', err))
      ),
      topCommentedProjects: this.api.analyticsDashboardControllerGetTopCommentedProjects(startDate, endDate, projectPlanCode, limit).pipe(
        catchError(err => this.handleApiError('topCommentedProjects', err))
      ),
      nonInitialPublishedProjectCountByDistrict: this.api.analyticsDashboardControllerGetNonInitialPublishedProjectCountByDistrict(startDate, endDate, projectPlanCode).pipe(
        catchError(err => this.handleApiError('nonInitialPublishedProjectCountByDistrict', err))
      ),
      uniqueForestClientCount: this.api.analyticsDashboardControllerGetUniqueForestClientCount(startDate, endDate, projectPlanCode).pipe(
        catchError(err => this.handleApiError('uniqueForestClientCount', err))
      ),
      nonInitialPublishedProjectCountByForestClient: this.api.analyticsDashboardControllerGetNonInitialPublishedProjectCountByForestClient(startDate, endDate, projectPlanCode).pipe(
        catchError(err => this.handleApiError('nonInitialPublishedProjectCountByForestClient', err))
      ),
    //   commentCountByDistrict: this.api.analyticsDashboardControllerGetCommentCountByDistrict(startDate, endDate, projectPlanCode).pipe(
    //     catchError(err => { console.error('Failed to fetch commentCountByDistrict', err); return of({ message: err } as ApiError); })
    //   ),
    //   commentCountByForestClient: this.api.analyticsDashboardControllerGetCommentCountByForestClient(startDate, endDate, projectPlanCode).pipe(
    //     catchError(err => { console.error('Failed to fetch commentCountByForestClient', err); return of(null); })
    //   ),
    });
  }
  
  private handleApiError = (context: string, err: any) => {
    console.error(`Failed to fetch ${context}`, err);
    return of(new ApiError(err));
  };
}

/**
 * Maps the API response for comment counts by response code.
 * Source data: [{"responseCode":"NOT_CATEGORIZED","publicCommentCount":"115"},{"responseCode":"CONSIDERED","publicCommentCount":"71"},{"responseCode":"ADDRESSED","publicCommentCount":"38"}]
 * Expected mapping: {"NOT_CATEGORIZED":115,"CONSIDERED":71,"ADDRESSED":38}
 */
const mapCommentCountByResponseCodeFn = (data: { responseCode: string; publicCommentCount: number }[]) => {
  return data.reduce((acc, curr) => {
    acc[curr.responseCode] = curr.publicCommentCount;
    return acc;
  }, {} as Record<string, number>);
};
