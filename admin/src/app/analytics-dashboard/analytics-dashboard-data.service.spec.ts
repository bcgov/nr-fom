import { TestBed } from '@angular/core/testing';
import { AnalyticsDashboardDataService } from './analytics-dashboard-data.service';
import { AnalyticsDashboardService } from '@api-client';

describe('AnalyticsDashboardDataService', () => {
  let service: AnalyticsDashboardDataService;
  let apiMock: jest.Mocked<AnalyticsDashboardService>;

  beforeEach(() => {
    apiMock = {
      analyticsDashboardControllerGetNonInitialPublishedProjectCount: jest.fn(),
      analyticsDashboardControllerGetCommentCountByResponseCode: jest.fn(),
      analyticsDashboardControllerGetTopCommentedProjects: jest.fn(),
      analyticsDashboardControllerGetCommentCountByDistrict: jest.fn(),
      analyticsDashboardControllerGetNonInitialPublishedProjectCountByDistrict: jest.fn(),
      analyticsDashboardControllerGetUniqueForestClientCount: jest.fn(),
      analyticsDashboardControllerGetNonInitialPublishedProjectCountByForestClient: jest.fn(),
    } as any;
    TestBed.configureTestingModule({
      providers: [
        AnalyticsDashboardDataService,
        { provide: AnalyticsDashboardService, useValue: apiMock },
      ],
    });
    service = TestBed.inject(AnalyticsDashboardDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
