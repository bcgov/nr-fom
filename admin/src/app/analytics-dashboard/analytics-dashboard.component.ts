import { UploadBoxComponent } from '@admin-core/components/file-upload-box/file-upload-box.component';
import { AppFormControlDirective } from '@admin-core/directives/form-control.directive';
import { NewlinesPipe } from '@admin-core/pipes/newlines.pipe';
import { ANALYTICS_DATA_DEFAULT_SIZE, DEFAULT_ISO_DATE_FORMAT, FOM_GO_LIVE_DATE } from '@admin-core/utils/constants';
import { DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { AfterViewInit, Component, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectPlanCodeFilterEnum, ResponseCodeEnum } from '@api-client';
import { ChartOptions, commentsByResponseCodeChartOptions, fomsCountByDistrictChartOptions, fomsCountByForestClientChartOptions, maxAxis, topCommentedProjectsChartOptions } from 'app/analytics-dashboard/analytics-dashboard-chart-config';
import { AnalyticsDashboardData, AnalyticsDashboardDataService } from 'app/analytics-dashboard/analytics-dashboard-data.service';
import { DateTime } from 'luxon';
import {
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
  selectedPlan: ProjectPlanCodeFilterEnum = this.planFilterOptions[0]?.value;
  minStartDate: Date = DateTime.fromISO(FOM_GO_LIVE_DATE).startOf('day').toJSDate();
  
  // chart options
  commentsByResponseCodeChartOptions: Partial<ChartOptions>; // Comments by response code chart options
  topCommentedProjectsChartOptions: Partial<ChartOptions>;
  fomsCountByDistrictChartOptions: Partial<ChartOptions>;
  fomsCountByForestClientChartOptions: Partial<ChartOptions>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private analyticsDashboardDataService: AnalyticsDashboardDataService
  ) {
  }

  ngOnInit() {
    this.analyticsData.set(this.route.snapshot.data['analyticsData']);
    console.log('Analytics data loaded:', this.analyticsData());
    this.selectedPlan = this.planFilterOptions[0]?.value;
    this.startDate = DateTime.fromISO(FOM_GO_LIVE_DATE).startOf('day').toJSDate();
    this.endDate = new Date();

    this.applyChartOptions();
  }

  async ngAfterViewInit() {
    // Implement a delay before setting isInitialized to true
    await new Promise(resolve => setTimeout(resolve, 1000)); // 500ms delay
    this.isInitialized = true;
  }

  onDateChange(type: 'startDate' | 'endDate', value: Date) {
    if (type === 'startDate') {
      this.startDate = value;
    } else if (type === 'endDate') {
      this.endDate = value;
    }
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

  fetchAnalyticsData() {
    const startDateStr = this.startDate ? DateTime.fromJSDate(this.startDate).toFormat(DEFAULT_ISO_DATE_FORMAT) : FOM_GO_LIVE_DATE;
    const endDateStr = this.endDate ? DateTime.fromJSDate(this.endDate).toFormat(DEFAULT_ISO_DATE_FORMAT) :  DateTime.fromJSDate(new Date()).toFormat(DEFAULT_ISO_DATE_FORMAT);
    const selectedPlan = this.selectedPlan;
    const limit = ANALYTICS_DATA_DEFAULT_SIZE; // TODO, implement this, not hardcoded.
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
    this.commentsByResponseCodeChartOptions = commentsByResponseCodeChartOptions;
    const data = this.analyticsData().commentCountByResponseCode;
    this.commentsByResponseCodeChartOptions.series = [{
      name: this.commentsByResponseCodeChartOptions.series[0].name,
      data: [
        data[ResponseCodeEnum.Considered] || 0,
        data[ResponseCodeEnum.Addressed] || 0,
        data['NOT_CATEGORIZED'] || 0
      ]
    }];
  }

  applyTopCommentedProjectsChartOptions() {
    this.topCommentedProjectsChartOptions = topCommentedProjectsChartOptions;
    const data = this.analyticsData().topCommentedProjects;
    if (Array.isArray(data)) {
      this.topCommentedProjectsChartOptions.xaxis.categories = data.map(
        item => item.projectId + "(" + item.districtName + "), " + item.forestClientName + "\u00A0\u00A0"
      );
      this.topCommentedProjectsChartOptions.series = [{
        name: this.topCommentedProjectsChartOptions.series[0].name,
        data: data.map(item => item.publicCommentCount)
      }];
      this.topCommentedProjectsChartOptions.xaxis.max = maxAxis(this.topCommentedProjectsChartOptions.series[0].data);
      this.topCommentedProjectsChartOptions.chart.height = Math.max(330, data.length * 30); // adjust height dynamically for horizontal bar chart
    }
  }

  applyFomsCountByDistrictChartOptions() {
    this.fomsCountByDistrictChartOptions = fomsCountByDistrictChartOptions;
    const data = this.analyticsData().nonInitialPublishedProjectCountByDistrict;

    // TODO, update chart for horizontal bas does not work entirely, need to try `this.chart.updateOptions` with @ViewChild("chart") chart!: ChartComponent;
    if (Array.isArray(data) && data.length > 0) {
        this.fomsCountByDistrictChartOptions.xaxis.categories = data.map(
          item => item.districtName + "\u00A0\u00A0"
        );
        this.fomsCountByDistrictChartOptions.series = [{
          name: this.fomsCountByDistrictChartOptions.series[0].name,
          data: data.map(item => item.projectCount)
        }];

      this.fomsCountByDistrictChartOptions.xaxis.max = maxAxis(this.fomsCountByDistrictChartOptions.series[0].data);
      this.fomsCountByDistrictChartOptions.chart.height = Math.max(330, data.length * 30); // adjust height dynamically for horizontal bar chart
    }
  }

  applyFomsCountByForestClientChartOptions() {
    this.fomsCountByForestClientChartOptions = fomsCountByForestClientChartOptions;
    const data = this.analyticsData().nonInitialPublishedProjectCountByForestClient;

    // TODO, update chart for horizontal bas does not work entirely, need to try `this.chart.updateOptions` with @ViewChild("chart") chart!: ChartComponent;
    if (Array.isArray(data) && data.length > 0) {
        this.fomsCountByForestClientChartOptions.xaxis.categories = data.map(
          item => item.forestClientName + "\u00A0\u00A0"
        );
        this.fomsCountByForestClientChartOptions.series = [{
          name: this.fomsCountByForestClientChartOptions.series[0].name,
          data: data.map(item => item.projectCount)
        }];

      this.fomsCountByForestClientChartOptions.xaxis.max = maxAxis(this.fomsCountByForestClientChartOptions.series[0].data);
      this.fomsCountByForestClientChartOptions.chart.height = Math.max(330, data.length * 30); // adjust height dynamically for horizontal bar chart
    }
  }
}
