import { TestBed } from '@angular/core/testing';
import { AnalyticsDashboardDataService } from './analytics-dashboard-data.service';
import { AnalyticsDashboardService } from '@api-client';
import { of, throwError } from 'rxjs';

describe('AnalyticsDashboardDataService', () => {
  let service: AnalyticsDashboardDataService;
  let apiSpy: jasmine.SpyObj<AnalyticsDashboardService>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('AnalyticsDashboardService', [
      'analyticsDashboardControllerGetNonInitialPublishedProjectCount',
      'analyticsDashboardControllerGetCommentCountByResponseCode',
      'analyticsDashboardControllerGetTopCommentedProjects',
      'analyticsDashboardControllerGetCommentCountByDistrict',
      'analyticsDashboardControllerGetNonInitialPublishedProjectCountByDistrict',
      'analyticsDashboardControllerGetUniqueForestClientCount',
      'analyticsDashboardControllerGetNonInitialPublishedProjectCountByForestClient',
    ]);
    TestBed.configureTestingModule({
      providers: [
        AnalyticsDashboardDataService,
        { provide: AnalyticsDashboardService, useValue: spy },
      ],
    });
    service = TestBed.inject(AnalyticsDashboardDataService);
    apiSpy = TestBed.inject(AnalyticsDashboardService) as jasmine.SpyObj<AnalyticsDashboardService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // Add more tests for getAnalyticsData and error handling here
});
