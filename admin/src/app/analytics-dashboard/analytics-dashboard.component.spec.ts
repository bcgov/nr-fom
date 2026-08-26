import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AnalyticsDashboardComponent } from './analytics-dashboard.component';
import { AnalyticsDashboardDataService, AnalyticsDashboardData, ApiError } from './analytics-dashboard-data.service';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ProjectPlanCodeFilterEnum } from '@api-client';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';

describe('AnalyticsDashboardComponent', () => {
  let component: AnalyticsDashboardComponent;
  let fixture: ComponentFixture<AnalyticsDashboardComponent>;
  let mockDataService: any;

  const mockAnalyticsData: AnalyticsDashboardData = {
    nonInitialPublishedProjectCount: 15,
    commentCountByResponseCode: {
      'CONSIDERED': 5,
      'ADDRESSED': 10,
      'IRRELEVANT': 0,
      'NOT_CATEGORIZED': 2
    },
    topCommentedProjects: [
      { projectId: 1, districtName: 'District A', forestClientName: 'Client X', publicCommentCount: 50 }
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
      { forestClientId: 'fc1', forestClientName: 'Client X', projectCount: 5 }
    ]
  };

  beforeEach(async () => {
    mockDataService = {
      getAnalyticsData: jest.fn().mockReturnValue(of(mockAnalyticsData))
    };

    await TestBed.configureTestingModule({
      imports: [AnalyticsDashboardComponent, NoopAnimationsModule, BsDatepickerModule.forRoot()],
      providers: [
        { provide: AnalyticsDashboardDataService, useValue: mockDataService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyticsDashboardComponent);
    component = fixture.componentInstance;
    
    // Set required signal inputs
    fixture.componentRef.setInput('analyticsData', mockAnalyticsData);
  });

  it('should create and initialize charts after view init delay', fakeAsync(() => {
    fixture.detectChanges(); // Trigger ngOnInit
    expect(component).toBeTruthy();
    expect(component.isInitialized).toBe(false);

    // fast forward 500ms delay in ngAfterViewInit
    tick(500);
    fixture.detectChanges();

    expect(component.isInitialized).toBe(true);
    
    // Check that view children are resolved
    expect(component.commentsByResponseCodeChart()).toBeTruthy();
    expect(component.topCommentedProjectsChart()).toBeTruthy();
    expect(component.fomsCountByDistrictChart()).toBeTruthy();
    expect(component.commentsByDistrictChart()).toBeTruthy();
    expect(component.fomsCountByForestClientChart()).toBeTruthy();
  }));

  it('should call fetchAnalyticsData when filter changes', fakeAsync(() => {
    fixture.detectChanges();
    tick(500);
    fixture.detectChanges();
    
    // Clear mock calls from initial setup if any
    mockDataService.getAnalyticsData.mockClear();

    // Trigger a filter change
    component.onPlanFilterChange(ProjectPlanCodeFilterEnum.Woodlot);
    
    expect(mockDataService.getAnalyticsData).toHaveBeenCalled();
    expect(component.selectedPlan).toBe(ProjectPlanCodeFilterEnum.Woodlot);
  }));
  it('should handle empty arrays and zero counts without errors', fakeAsync(() => {
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
    tick(500);
    fixture.detectChanges();
    
    // Changing filter to force updateOptions with empty arrays
    component.onFcLimitChange(10);
    expect(component.isInitialized).toBe(true);
    // Should not throw
  }));

  it('should handle ApiError responses gracefully', fakeAsync(() => {
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
    tick(500);
    fixture.detectChanges();
    
    // Changing filter to force updateOptions with ApiError
    component.onDistrictFilterChange(null);
    expect(component.isInitialized).toBe(true);
    // Should not throw
  }));
});
