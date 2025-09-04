import { Injectable } from '@angular/core';
import { AnalyticsDashboardService, ProjectPlanCodeFilterEnum } from '@api-client';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export type ApiError = {
  message: any;
}

export type AnalyticsDashboardData = {
  nonInitialPublishedProjectCount: number | ApiError; // Total FOM count
  commentCountByResponseCode: Record<string, number> | ApiError;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsDashboardDataService {
  constructor(private api: AnalyticsDashboardService) {}

  getAnalyticsData(
    startDate: string, endDate: string, 
    projectPlanCode: ProjectPlanCodeFilterEnum = ProjectPlanCodeFilterEnum.Fsp, 
    limit: number = 15
  ) {
    return forkJoin({
    //   commentCountByDistrict: this.api.analyticsDashboardControllerGetCommentCountByDistrict(startDate, endDate, projectPlanCode).pipe(
    //     catchError(err => { console.error('Failed to fetch commentCountByDistrict', err); return of(null); })
    //   ),
    //   commentCountByForestClient: this.api.analyticsDashboardControllerGetCommentCountByForestClient(startDate, endDate, projectPlanCode).pipe(
    //     catchError(err => { console.error('Failed to fetch commentCountByForestClient', err); return of(null); })
    //   ),
      commentCountByResponseCode: this.api.analyticsDashboardControllerGetCommentCountByResponseCode(startDate, endDate, projectPlanCode).pipe(
        map(mapCommentCountByResponseCodeFn),
        catchError(err => { console.error('Failed to fetch commentCountByResponseCode', err); return of({ message: err } as ApiError); })
      ),
      nonInitialPublishedProjectCount: this.api.analyticsDashboardControllerGetNonInitialPublishedProjectCount(startDate, endDate, projectPlanCode).pipe(
        catchError(err => { console.error('Failed to fetch nonInitialPublishedProjectCount', err); return of({ message: err }); })
      ),
    //   nonInitialPublishedProjectCountByDistrict: this.api.analyticsDashboardControllerGetNonInitialPublishedProjectCountByDistrict(startDate, endDate, projectPlanCode).pipe(
    //     catchError(err => { console.error('Failed to fetch nonInitialPublishedProjectCountByDistrict', err); return of(null); })
    //   ),
    //   nonInitialPublishedProjectCountByForestClient: this.api.analyticsDashboardControllerGetNonInitialPublishedProjectCountByForestClient(startDate, endDate, projectPlanCode).pipe(
    //     catchError(err => { console.error('Failed to fetch nonInitialPublishedProjectCountByForestClient', err); return of(null); })
    //   ),
    //   topCommentedProjects: this.api.analyticsDashboardControllerGetTopCommentedProjects(startDate, endDate, projectPlanCode, limit).pipe(
    //     catchError(err => { console.error('Failed to fetch topCommentedProjects', err); return of(null); })
    //   ),
    //   uniqueForestClientCount: this.api.analyticsDashboardControllerGetUniqueForestClientCount(startDate, endDate, projectPlanCode).pipe(
    //     catchError(err => { console.error('Failed to fetch uniqueForestClientCount', err); return of(null); })
    //   ),
    });
  }
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
