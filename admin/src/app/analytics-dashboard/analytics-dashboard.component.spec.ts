import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ProjectPlanCodeFilterEnum } from '@api-client';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';

// Mock ng-apexcharts before the component is imported.
// jest.mock is hoisted above all imports. The factory returns plain objects
// that Angular treats as standalone components/modules. The stub needs no
// decorators — Angular only needs the class at the module-resolution level;
// the actual template matching is handled by overrideComponent below.
jest.mock('ng-apexcharts', () => {
  class StubChartComponent {
    updateOptions = jest.fn();
  }
  return {
    __esModule: true,
    NgApexchartsModule: class {},
    ChartComponent: StubChartComponent,
  };
});

// Safe to import now — the decorator's NgApexchartsModule reference
// resolves to our empty class, not the real 200KB library.
import { AnalyticsDashboardComponent } from './analytics-dashboard.component';
import { AnalyticsDashboardDataService, AnalyticsDashboardData, ApiError } from './analytics-dashboard-data.service';
import { Component, Input } from '@angular/core';

/**
 * Real Angular stub component for template matching.
 * This replaces NgApexchartsModule's ChartComponent in the component's
 * imports via TestBed.overrideComponent so the <apx-chart> elements
 * in the template resolve to this lightweight stub.
 */
@Component({
  selector: 'apx-chart',
  template: '<div></div>',
  standalone: true,
})
class MockApxChartComponent {
  @Input() series: unknown;
  @Input() chart: unknown;
  @Input() xaxis: unknown;
  @Input() yaxis: unknown;
  @Input() title: unknown;
  @Input() subtitle: unknown;
  @Input() colors: unknown;
  @Input() dataLabels: unknown;
  @Input() stroke: unknown;
  @Input() fill: unknown;
  @Input() tooltip: unknown;
  @Input() plotOptions: unknown;
  @Input() legend: unknown;
  @Input() grid: unknown;
  @Input() noData: unknown;
  @Input() responsive: unknown;
  updateOptions = jest.fn();
}

/**
 * Advance jest fake timers by `ms` and flush the microtask queue so that
 * the `await new Promise(…)` in ngAfterViewInit settles before assertions.
 */
async function advanceAndFlush(ms: number): Promise<void> {
  jest.advanceTimersByTime(ms);
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

    // Import the component (with the mocked ng-apexcharts), then swap
    // the mocked NgApexchartsModule for our real Angular MockApxChartComponent
    // so the template's <apx-chart> elements are matched.
    const NgApexchartsModule = (await import('ng-apexcharts')).NgApexchartsModule;

    await TestBed.configureTestingModule({
      imports: [AnalyticsDashboardComponent, NoopAnimationsModule, BsDatepickerModule],
      providers: [
        { provide: AnalyticsDashboardDataService, useValue: mockDataService }
      ]
    })
    .overrideComponent(AnalyticsDashboardComponent, {
      remove: { imports: [NgApexchartsModule as any] },
      add: { imports: [MockApxChartComponent] }
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnalyticsDashboardComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('analyticsData', mockAnalyticsData);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should create and initialize charts after view init delay', async () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component.isInitialized).toBe(false);

    await advanceAndFlush(500);
    fixture.detectChanges();

    expect(component.isInitialized).toBe(true);

    // All 5 chart viewChild references resolve to MockApxChartComponent
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
