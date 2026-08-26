import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AnalyticsDashboardComponent } from './analytics-dashboard.component';
import { AnalyticsDashboardDataService, AnalyticsDashboardData, ApiError } from './analytics-dashboard-data.service';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ProjectPlanCodeFilterEnum } from '@api-client';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';

/**
 * Advance jest fake timers by `ms` and then flush the microtask queue so that
 * any `await`-ed Promises (like the one in ngAfterViewInit) settle before
 * assertions run.
 */
async function advanceAndFlush(ms: number): Promise<void> {
  jest.advanceTimersByTime(ms);
  // Flushing the microtask queue lets the `await new Promise(…)` in
  // ngAfterViewInit resolve before we continue.
  await Promise.resolve();
}

describe('AnalyticsDashboardComponent', () => {
  let component: AnalyticsDashboardComponent;
  let fixture: ComponentFixture<AnalyticsDashboardComponent>;
  let mockDataService: { getAnalyticsData: jest.Mock };

  const mockAnalyticsData: AnalyticsDashboardData = {
    nonInitialPublishedProjectCount: 15,
    commentCountByResponseCode: {
      'CONSIDERED': 5,
      'ADDRESSED': 10,
      'IRRELEVANT': 0,
      'NOT_CATEGORIZED': 2
    },
    topCommentedProjects: [
      { projectId: '1', projectName: 'Project A', districtName: 'District A', forestClientName: 'Client X', publicCommentCount: 50 }
    ],
    commentCountByDistrict: [
      {
        districtId: 1,
        districtName: 'District A',
        totalPublicCommentCount: 10,
        commentCountByCategory: [
          { responseCode: 'CONSIDERED', publicCommentCount: 10 }
        ]
      }
    ],
    nonInitialPublishedProjectCountByDistrict: [
      { districtId: 1, districtName: 'District A', projectCount: 5 }
    ],
    uniqueForestClientCount: 3,
    nonInitialPublishedProjectCountByForestClient: [
      { forestClientNumber: 'fc1', forestClientName: 'Client X', projectCount: 5 }
    ]
  };

  beforeEach(async () => {
    jest.useFakeTimers();

    mockDataService = {
      getAnalyticsData: jest.fn().mockReturnValue(of(mockAnalyticsData))
    };

    await TestBed.configureTestingModule({
      imports: [AnalyticsDashboardComponent, NoopAnimationsModule, BsDatepickerModule],
      providers: [
        { provide: AnalyticsDashboardDataService, useValue: mockDataService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyticsDashboardComponent);
    component = fixture.componentInstance;

    // Set required signal inputs
    fixture.componentRef.setInput('analyticsData', mockAnalyticsData);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should create and initialize charts after view init delay', async () => {
    fixture.detectChanges(); // triggers ngOnInit + ngAfterViewInit (which awaits setTimeout)
    expect(component).toBeTruthy();
    expect(component.isInitialized).toBe(false);

    await advanceAndFlush(500);
    fixture.detectChanges();

    expect(component.isInitialized).toBe(true);

    // All 5 chart viewChild references should be resolved
    expect(component.commentsByResponseCodeChart()).toBeTruthy();
    expect(component.topCommentedProjectsChart()).toBeTruthy();
    expect(component.fomsCountByDistrictChart()).toBeTruthy();
    expect(component.commentsByDistrictChart()).toBeTruthy();
    expect(component.fomsCountByForestClientChart()).toBeTruthy();
  });

  it('should call fetchAnalyticsData when filter changes', async () => {
    fixture.detectChanges();
    await advanceAndFlush(500);
    fixture.detectChanges();

    mockDataService.getAnalyticsData.mockClear();

    component.onPlanFilterChange(ProjectPlanCodeFilterEnum.Woodlot);

    expect(mockDataService.getAnalyticsData).toHaveBeenCalled();
    expect(component.selectedPlan).toBe(ProjectPlanCodeFilterEnum.Woodlot);
  });

  it('should handle empty arrays and zero counts without errors', async () => {
    const emptyData: AnalyticsDashboardData = {
      nonInitialPublishedProjectCount: 0,
      commentCountByResponseCode: { 'CONSIDERED': 0 },
      topCommentedProjects: [],
      commentCountByDistrict: [],
      nonInitialPublishedProjectCountByDistrict: [],
      uniqueForestClientCount: 0,
      nonInitialPublishedProjectCountByForestClient: []
    };

    mockDataService.getAnalyticsData.mockReturnValue(of(emptyData));
    fixture.componentRef.setInput('analyticsData', emptyData);

    fixture.detectChanges();
    await advanceAndFlush(500);
    fixture.detectChanges();

    component.onFcLimitChange(10);
    expect(component.isInitialized).toBe(true);
  });

  it('should handle ApiError responses gracefully', async () => {
    const errorData: AnalyticsDashboardData = {
      nonInitialPublishedProjectCount: new ApiError('500 Internal Server Error'),
      commentCountByResponseCode: new ApiError('500 Internal Server Error'),
      topCommentedProjects: new ApiError('500 Internal Server Error'),
      commentCountByDistrict: new ApiError('403 Forbidden'),
      nonInitialPublishedProjectCountByDistrict: new ApiError('404 Not Found'),
      uniqueForestClientCount: new ApiError('500 Internal Server Error'),
      nonInitialPublishedProjectCountByForestClient: new ApiError('500 Internal Server Error')
    };

    mockDataService.getAnalyticsData.mockReturnValue(of(errorData));
    fixture.componentRef.setInput('analyticsData', errorData);

    fixture.detectChanges();
    await advanceAndFlush(500);
    fixture.detectChanges();

    component.onDistrictFilterChange(null);
    expect(component.isInitialized).toBe(true);
  });
});
