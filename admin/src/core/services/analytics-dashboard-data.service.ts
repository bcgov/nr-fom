import { Injectable } from '@angular/core';
import { AnalyticsDashboardService, ProjectPlanCodeFilterEnum } from '@api-client';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AnalyticsDashboardDataService {
  constructor(private api: AnalyticsDashboardService) {}

  getAnalyticsData(
    startDate: string, endDate: string, 
    projectPlanCode: ProjectPlanCodeFilterEnum = ProjectPlanCodeFilterEnum.Fsp, 
    limit: number = 15
  ) {
    return forkJoin({
      commentCountByDistrict: this.api.analyticsDashboardControllerGetCommentCountByDistrict(startDate, endDate, projectPlanCode).pipe(
        catchError(err => { console.error('Failed to fetch commentCountByDistrict', err); return of(null); })
      ),
      commentCountByForestClient: this.api.analyticsDashboardControllerGetCommentCountByForestClient(startDate, endDate, projectPlanCode).pipe(
        catchError(err => { console.error('Failed to fetch commentCountByForestClient', err); return of(null); })
      ),
      commentCountByResponseCode: this.api.analyticsDashboardControllerGetCommentCountByResponseCode(startDate, endDate, projectPlanCode).pipe(
        catchError(err => { console.error('Failed to fetch commentCountByResponseCode', err); return of(null); })
      ),
      nonInitialPublishedProjectCount: this.api.analyticsDashboardControllerGetNonInitialPublishedProjectCount(startDate, endDate, projectPlanCode).pipe(
        catchError(err => { console.error('Failed to fetch nonInitialPublishedProjectCount', err); return of(null); })
      ),
      nonInitialPublishedProjectCountByDistrict: this.api.analyticsDashboardControllerGetNonInitialPublishedProjectCountByDistrict(startDate, endDate, projectPlanCode).pipe(
        catchError(err => { console.error('Failed to fetch nonInitialPublishedProjectCountByDistrict', err); return of(null); })
      ),
      nonInitialPublishedProjectCountByForestClient: this.api.analyticsDashboardControllerGetNonInitialPublishedProjectCountByForestClient(startDate, endDate, projectPlanCode).pipe(
        catchError(err => { console.error('Failed to fetch nonInitialPublishedProjectCountByForestClient', err); return of(null); })
      ),
      topCommentedProjects: this.api.analyticsDashboardControllerGetTopCommentedProjects(startDate, endDate, projectPlanCode, limit).pipe(
        catchError(err => { console.error('Failed to fetch topCommentedProjects', err); return of(null); })
      ),
      uniqueForestClientCount: this.api.analyticsDashboardControllerGetUniqueForestClientCount(startDate, endDate, projectPlanCode).pipe(
        catchError(err => { console.error('Failed to fetch uniqueForestClientCount', err); return of(null); })
      ),
    });
  }
}
