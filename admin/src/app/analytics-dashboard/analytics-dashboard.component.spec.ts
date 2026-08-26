import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AnalyticsDashboardComponent } from './analytics-dashboard.component';
import { AnalyticsDashboardDataService, AnalyticsDashboardData } from './analytics-dashboard-data.service';
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
});
