import { inject } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AnalyticsDashboardService } from '../../../../libs/client/typescript-ng/api/analyticsDashboard.service';

export const analyticsResolver = () => {
  const analyticsService = inject(AnalyticsDashboardService);
  // Example date range, adjust as needed or make dynamic
  const startDate = '2024-01-01';
  const endDate = '2025-12-31';
  const limit = 15;

  return forkJoin({
    commentCountByDistrict: analyticsService.analyticsDashboardControllerGetCommentCountByDistrict(startDate, endDate).pipe(
      catchError(err => { console.error('Failed to fetch commentCountByDistrict', err); return of(null); })
    ),
    commentCountByForestClient: analyticsService.analyticsDashboardControllerGetCommentCountByForestClient(startDate, endDate).pipe(
      catchError(err => { console.error('Failed to fetch commentCountByForestClient', err); return of(null); })
    ),
    commentCountByResponseCode: analyticsService.analyticsDashboardControllerGetCommentCountByResponseCode(startDate, endDate).pipe(
      catchError(err => { console.error('Failed to fetch commentCountByResponseCode', err); return of(null); })
    ),
    nonInitialPublishedProjectCount: analyticsService.analyticsDashboardControllerGetNonInitialPublishedProjectCount(startDate, endDate).pipe(
      catchError(err => { console.error('Failed to fetch nonInitialPublishedProjectCount', err); return of(null); })
    ),
    nonInitialPublishedProjectCountByDistrict: analyticsService.analyticsDashboardControllerGetNonInitialPublishedProjectCountByDistrict(startDate, endDate).pipe(
      catchError(err => { console.error('Failed to fetch nonInitialPublishedProjectCountByDistrict', err); return of(null); })
    ),
    nonInitialPublishedProjectCountByForestClient: analyticsService.analyticsDashboardControllerGetNonInitialPublishedProjectCountByForestClient(startDate, endDate).pipe(
      catchError(err => { console.error('Failed to fetch nonInitialPublishedProjectCountByForestClient', err); return of(null); })
    ),
    topCommentedProjects: analyticsService.analyticsDashboardControllerGetTopCommentedProjects(startDate, endDate, limit).pipe(
      catchError(err => { console.error('Failed to fetch topCommentedProjects', err); return of(null); })
    ),
    uniqueForestClientCount: analyticsService.analyticsDashboardControllerGetUniqueForestClientCount(startDate, endDate).pipe(
      catchError(err => { console.error('Failed to fetch uniqueForestClientCount', err); return of(null); })
    ),
  });
};