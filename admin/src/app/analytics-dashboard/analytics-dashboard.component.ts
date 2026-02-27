import { ANALYTICS_DATA_DEFAULT_SIZE, DEFAULT_ISO_DATE_FORMAT, FOM_GO_LIVE_DATE } from '@admin-core/utils/constants';
import { DatePipe, NgFor } from '@angular/common';
import { AfterViewInit, Component, OnInit, signal, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute } from '@angular/router';
import { ProjectPlanCodeFilterEnum, ResponseCodeEnum } from '@api-client';
import { ChartOptions, commentsByDistrictChartOptions, commentsByResponseCodeChartOptions, fomsCountByDistrictChartOptions, fomsCountByForestClientChartOptions, maxAxis, maxAxis as maxxAxis, RESPONSE_CODE_COLORS, RESPONSE_CODE_LABELS, topCommentedProjectsChartOptions } from 'app/analytics-dashboard/analytics-dashboard-chart-config';
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
      FormsModule,
      ReactiveFormsModule,
      BsDatepickerModule,
      NgApexchartsModule,
      NgFor,
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
  isInitialized = false; // Is Angular view done initialization
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
  selectedFcLimit: number = this.fcLimitOptions[0].value; // default
  districtFilterOptions: Array<{ value: number | null, label: string }> = [];
  selectedDistrict: number | null = null; // null means 'All districts'
  minDate: Date = DateTime.fromISO(FOM_GO_LIVE_DATE).startOf('day').toJSDate();
  maxDate: Date = new Date(); // today
  
  // chart Angular views
  @ViewChild("commentsByResponseCodeChart") commentsByResponseCodeChart!: ChartComponent;
  @ViewChild("topCommentedProjectsChart") topCommentedProjectsChart!: ChartComponent;
  @ViewChild("fomsCountByDistrictChart") fomsCountByDistrictChart!: ChartComponent;
  @ViewChild("commentsByDistrictChart") commentsByDistrictChart!: ChartComponent;
  @ViewChild("fomsCountByForestClientChart") fomsCountByForestClientChart!: ChartComponent;

  // chart options
  commentsByResponseCodeChartOptions: Partial<ChartOptions>;
  topCommentedProjectsChartOptions: Partial<ChartOptions>;
  fomsCountByDistrictChartOptions: Partial<ChartOptions>;
  commentsByDistrictChartOptions: Partial<ChartOptions>;
  fomsCountByForestClientChartOptions: Partial<ChartOptions>;

  constructor(
    private route: ActivatedRoute,
    private analyticsDashboardDataService: AnalyticsDashboardDataService
  ) {
    // Initialize empty chart options earlier.
    this.commentsByResponseCodeChartOptions = commentsByResponseCodeChartOptions;
    this.topCommentedProjectsChartOptions = topCommentedProjectsChartOptions;
    this.fomsCountByDistrictChartOptions = fomsCountByDistrictChartOptions;
    this.commentsByDistrictChartOptions = commentsByDistrictChartOptions;
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
    await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
    this.isInitialized = true;

    // only apply chart options after view is init
    this.applyChartOptions();
  }

  onDateChange(type: 'startDate' | 'endDate', value: Date) {
    if (type === 'startDate') {
      this.startDate = value;
      // If new startDate is after endDate, adjust endDate
      if (this.endDate && this.startDate > this.endDate) {
        this.endDate = new Date(this.startDate);
      }
    } else if (type === 'endDate') {
      this.endDate = value;
      // If new endDate is before startDate, adjust startDate
      if (this.startDate && this.endDate < this.startDate) {
        this.startDate = new Date(this.endDate);
      }
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

  onDistrictFilterChange(value: number | null) {
    this.selectedDistrict = value;
    this.applyCommentsByDistrictChartOptions();
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
    this.applyCommentsByDistrictChartOptions();
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
            apiData['NOT_CATEGORIZED'] || 0
          ]
        }],
        yaxis: {
            min: 0,
            max: maxAxis(Object.values(apiData))
        }
      });
    }
  }

  applyTopCommentedProjectsChartOptions() {
    const apiData = this.analyticsData().topCommentedProjects;
    if (apiData && !(apiData instanceof ApiError)) {
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
          height: Math.max(330, apiData.length * 50)
        }
      });
    }
  }

  applyFomsCountByDistrictChartOptions() {
    const apiData = this.analyticsData().nonInitialPublishedProjectCountByDistrict;
    if (apiData && !(apiData instanceof ApiError)) {
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
          height: Math.max(260, apiData.length * 50)
        }
      });
    }
  }

  applyCommentsByDistrictChartOptions() {
    const apiData = this.analyticsData().commentCountByDistrict;
    if (apiData && !(apiData instanceof ApiError)) {
      // Update district filter options
      this.districtFilterOptions = [
        { value: null, label: 'All districts' },
        ...apiData.map(item => ({ value: item.districtId, label: item.districtName }))
      ];

      // Filter data based on selected district
      const filteredData = this.selectedDistrict === null 
        ? apiData 
        : apiData.filter(item => item.districtId === this.selectedDistrict);

      if (filteredData.length === 0) return;

      // Collect all unique response codes across all districts
      const allResponseCodes = new Set<string>();
      filteredData.forEach(district => {
        district.commentCountByCategory.forEach(cat => {
          allResponseCodes.add(cat.responseCode);
        });
      });

      // Build series - one for each category + total
      const series: any[] = [];
      const seriesColors: string[] = [];

      // Add series for each category
      allResponseCodes.forEach(responseCode => {
        const data = filteredData.map(district => {
          const category = district.commentCountByCategory.find(c => c.responseCode === responseCode);
          return category ? category.publicCommentCount : 0;
        });
        series.push({
          name: RESPONSE_CODE_LABELS[responseCode] || responseCode,
          data: data
        });
        seriesColors.push(RESPONSE_CODE_COLORS[responseCode] || '#999999');
      });

      // Add Total series
      const totalData = filteredData.map(district => district.totalPublicCommentCount);
      series.push({
        name: 'Total',
        data: totalData
      });
      seriesColors.push(RESPONSE_CODE_COLORS['TOTAL']);

      // Calculate max value for axis
      const allValues = series.flatMap(s => s.data);
      const maxValue = maxxAxis(allValues);

      // Update chart
      this.commentsByDistrictChart.updateOptions({
        series: series,
        xaxis: {
          categories: filteredData.map(item => item.districtName + "\u00A0\u00A0"),
          min: 0,
          max: maxValue
        },
        colors: seriesColors,
        chart: {
          height: Math.max(300, filteredData.length * 80)
        }
      });
    }
  }

  applyFomsCountByForestClientChartOptions() {
    const apiData = this.analyticsData().nonInitialPublishedProjectCountByForestClient;
    if (apiData && !(apiData instanceof ApiError)) {
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
          min: 0,
          max: maxxAxis(data)
        },
        chart: {
          // Horizontal bar chart dynamic height adjustment
          height: Math.max(260, data.length * 50)
        }
      });
    }
  }

}
