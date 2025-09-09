import { UploadBoxComponent } from '@admin-core/components/file-upload-box/file-upload-box.component';
import { AppFormControlDirective } from '@admin-core/directives/form-control.directive';
import { NewlinesPipe } from '@admin-core/pipes/newlines.pipe';
import { ANALYTICS_DATA_DEFAULT_SIZE, DEFAULT_ISO_DATE_FORMAT, FOM_GO_LIVE_DATE } from '@admin-core/utils/constants';
import { DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { AfterViewInit, Component, OnInit, signal, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute } from '@angular/router';
import { ProjectPlanCodeFilterEnum, ResponseCodeEnum } from '@api-client';
import { ChartOptions, commentsByResponseCodeChartOptions, fomsCountByDistrictChartOptions, fomsCountByForestClientChartOptions, maxAxis as maxxAxis, topCommentedProjectsChartOptions } from 'app/analytics-dashboard/analytics-dashboard-chart-config';
import { AnalyticsDashboardData, AnalyticsDashboardDataService, ApiError } from 'app/analytics-dashboard/analytics-dashboard-data.service';
import { DateTime } from 'luxon';
import {
  ChartComponent,
  NgApexchartsModule
} from 'ng-apexcharts';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';

@Component({
    standalone: true,
    imports: [
      NgIf,
      FormsModule,
      ReactiveFormsModule,
      BsDatepickerModule,
      NgClass,
      NgApexchartsModule,
      NgFor,
      AppFormControlDirective,
      NewlinesPipe,
      UploadBoxComponent,
      MatFormFieldModule,
      MatSelectModule,
      MatOptionModule
    ],
    selector: 'app-analytics-dashboard',
    templateUrl: './analytics-dashboard.component.html',
    styleUrls: ['./analytics-dashboard.component.scss'],
    providers: [DatePipe]
})
export class AnalyticsDashboardComponent implements OnInit, AfterViewInit {
  isInitialized = false;
  analyticsData = signal<AnalyticsDashboardData>(null);
  startDate: Date;
  endDate: Date;
  planFilterOptions = [
    { value: ProjectPlanCodeFilterEnum.Fsp, label: 'FSP Holder' },
    { value: ProjectPlanCodeFilterEnum.Woodlot, label: 'Woodlot Licensee' },
    { value: ProjectPlanCodeFilterEnum.All, label: 'All' }
  ];
  fcLimitOptions = [
    { value: 10, label: '10 Forest clients' },
    { value: 20, label: '20 Forest clients' },
    { value: 0, label: 'Show all' },
  ];
  selectedPlan: ProjectPlanCodeFilterEnum = this.planFilterOptions[0]?.value;
  selectedFcLimit: number = 10; // default
  minStartDate: Date = DateTime.fromISO(FOM_GO_LIVE_DATE).startOf('day').toJSDate();
  
  // chart view
  @ViewChild("commentsByResponseCodeChart") commentsByResponseCodeChart!: ChartComponent;
  @ViewChild("topCommentedProjectsChart") topCommentedProjectsChart!: ChartComponent;
  @ViewChild("fomsCountByDistrictChart") fomsCountByDistrictChart!: ChartComponent;
  @ViewChild("fomsCountByForestClientChart") fomsCountByForestClientChart!: ChartComponent;

  // chart options
  commentsByResponseCodeChartOptions: Partial<ChartOptions>;
  topCommentedProjectsChartOptions: Partial<ChartOptions>;
  fomsCountByDistrictChartOptions: Partial<ChartOptions>;
  fomsCountByForestClientChartOptions: Partial<ChartOptions>;

  constructor(
    private route: ActivatedRoute,
    private analyticsDashboardDataService: AnalyticsDashboardDataService
  ) {
    // Initialize chart options
    this.commentsByResponseCodeChartOptions = commentsByResponseCodeChartOptions;
    this.topCommentedProjectsChartOptions = topCommentedProjectsChartOptions;
    this.fomsCountByDistrictChartOptions = fomsCountByDistrictChartOptions;
    this.fomsCountByForestClientChartOptions = fomsCountByForestClientChartOptions;
  }

  ngOnInit() {
    this.analyticsData.set(this.route.snapshot.data['analyticsData']);
    console.log('Initial analytics data loaded:', this.analyticsData());
    this.selectedPlan = this.planFilterOptions[0]?.value;
    this.startDate = DateTime.fromISO(FOM_GO_LIVE_DATE).startOf('day').toJSDate();
    this.endDate = new Date();
  }

  async ngAfterViewInit() {
    // Implement a delay before setting isInitialized to true
    await new Promise(resolve => setTimeout(resolve, 1000)); // 500ms delay
    this.isInitialized = true;

    // only apply chart options after view is init
    this.applyChartOptions();
  }

  onDateChange(type: 'startDate' | 'endDate', value: Date) {
    if (type === 'startDate') {
      this.startDate = value;
    } else if (type === 'endDate') {
      this.endDate = value;
    }

    // only after view update is stable then fetch data
    if (this.isInitialized) {
      this.fetchAnalyticsData();
    }
  }

  onPlanFilterChange(value: ProjectPlanCodeFilterEnum) {
    this.selectedPlan = value;
    if (this.isInitialized) {
      this.fetchAnalyticsData();
    }
  }

  onFcLimitChange(value: number) {
    this.applyFomsCountByForestClientChartOptions();
  }

  /**
   * Fetch analytics data based on the current filters from backend and apply to chart options.
   */
  fetchAnalyticsData() {
    const startDateStr = this.startDate ? DateTime.fromJSDate(this.startDate).toFormat(DEFAULT_ISO_DATE_FORMAT) : FOM_GO_LIVE_DATE;
    const endDateStr = this.endDate ? DateTime.fromJSDate(this.endDate).toFormat(DEFAULT_ISO_DATE_FORMAT) :  DateTime.fromJSDate(new Date()).toFormat(DEFAULT_ISO_DATE_FORMAT);
    const selectedPlan = this.selectedPlan;
    const limit = ANALYTICS_DATA_DEFAULT_SIZE;
    console.log('Fetching analytics data with params:', { startDateStr, endDateStr, selectedPlan, limit });
    this.analyticsDashboardDataService.getAnalyticsData(startDateStr, endDateStr, selectedPlan, limit)
      .subscribe(data => {
        this.analyticsData.set(data);
        this.applyChartOptions();
        console.log("Analytics data loaded:", this.analyticsData());
    });
  }

  applyChartOptions() {
    this.applyCommentsByResponseCodeChartOptions();
    this.applyTopCommentedProjectsChartOptions();
    this.applyFomsCountByDistrictChartOptions();
    this.applyFomsCountByForestClientChartOptions();
  }

  applyCommentsByResponseCodeChartOptions() {
    const apiData = this.analyticsData().commentCountByResponseCode;
    if (apiData && !(apiData instanceof ApiError)) {
      this.commentsByResponseCodeChart.updateOptions({
        series: [{
          name: this.commentsByResponseCodeChartOptions.series[0].name,
          data: [
            apiData[ResponseCodeEnum.Considered] || 0,
            apiData[ResponseCodeEnum.Addressed] || 0,
            apiData[ResponseCodeEnum.Irrelevant] || 0,
            apiData['NOT_CATEGORIZED'] || 0
          ]
        }]
      });
    }
  }

  applyTopCommentedProjectsChartOptions() {
    const apiData = this.analyticsData().topCommentedProjects;
    if (apiData && Array.isArray(apiData)) {
      const data = apiData.map(item => item.publicCommentCount);
      this.topCommentedProjectsChart.updateOptions({
        series: [{
          name: this.topCommentedProjectsChartOptions.series[0].name,
          data: data
        }],
        xaxis: { 
          categories: apiData.map(item => 
            item.projectId + "(" + item.districtName + "), " + item.forestClientName + "\u00A0\u00A0"
          ),
          max: maxxAxis(data)
        },
        chart: {
          // Horizontal bar chart dynamic height adjustment
          height: Math.max(330, apiData.length * 30)
        }
      });
    }
  }

  applyFomsCountByDistrictChartOptions() {
    const apiData = this.analyticsData().nonInitialPublishedProjectCountByDistrict;
    if (apiData && Array.isArray(apiData)) {
      const data = apiData.map(item => item.projectCount);
      this.fomsCountByDistrictChart.updateOptions({
        series: [{
          name: this.fomsCountByDistrictChartOptions.series[0].name,
          data: data
        }],
        xaxis: {
          categories: apiData.map(item =>
            item.districtName + "\u00A0\u00A0"
          ),
          max: maxxAxis(data)
        },
        chart: {
          // Horizontal bar chart dynamic height adjustment
          height: Math.max(250, apiData.length * 40)
        }
      });
    }
  }

  applyFomsCountByForestClientChartOptions() {
    const apiData = this.analyticsData().nonInitialPublishedProjectCountByForestClient;
    if (Array.isArray(apiData) && apiData.length > 0) {
      // apply limit to the data set.
      console.log('Applying selected Forest clients limit:', this.selectedFcLimit);
      const slice = this.selectedFcLimit > 0 ? this.selectedFcLimit : apiData.length;
      const data = apiData
        .slice(0, slice)
        .map(item => item.projectCount);
      this.fomsCountByForestClientChart.updateOptions({
        series: [{
          name: this.fomsCountByForestClientChartOptions.series[0].name,
          data: data
        }],
        xaxis: {
          categories: apiData.slice(0, slice).map(item => item.forestClientName + "\u00A0\u00A0"),
          max: maxxAxis(data)
        },
        chart: {
          // Horizontal bar chart dynamic height adjustment
          height: Math.max(200, apiData.slice(0, slice).length * 40)
        }
      });
    }
  }

}
