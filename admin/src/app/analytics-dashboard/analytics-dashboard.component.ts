import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';

import { signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { RxFormBuilder } from '@rxweb/reactive-form-validators';

import { UploadBoxComponent } from '@admin-core/components/file-upload-box/file-upload-box.component';
import { AppFormControlDirective } from '@admin-core/directives/form-control.directive';
import { NewlinesPipe } from '@admin-core/pipes/newlines.pipe';
import { AnalyticsDashboardDataService } from '@admin-core/services/analytics-dashboard-data.service';
import { DEFAULT_ISO_DATE_FORMAT, FOM_GO_LIVE_DATE } from '@admin-core/utils/constants';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ProjectPlanCodeFilterEnum } from '@api-client';
import { DateTime } from 'luxon';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexLegend,
  ApexPlotOptions,
  ApexTitleSubtitle,
  ApexXAxis,
  ApexYAxis,
  NgApexchartsModule
} from 'ng-apexcharts';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  dataLabels: ApexDataLabels;
  plotOptions: ApexPlotOptions;
  yaxis: ApexYAxis;
  xaxis: ApexXAxis;
  fill: ApexFill;
  legend: ApexLegend;
  title: ApexTitleSubtitle
};
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
export class AnalyticsDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  isInitialized = false;
  analyticsData = signal<any>(null);
  startDate: Date;
  endDate: Date;
  planFilterOptions = [
    { value: ProjectPlanCodeFilterEnum.Fsp, label: 'FSP' },
    { value: ProjectPlanCodeFilterEnum.Woodlot, label: 'Woodlot' },
    { value: ProjectPlanCodeFilterEnum.All, label: 'All' }
  ];
  selectedPlan: ProjectPlanCodeFilterEnum = this.planFilterOptions[0]?.value;
  minStartDate: Date = DateTime.fromISO(FOM_GO_LIVE_DATE).startOf('day').toJSDate();
  
  // chart options
  public chartOptions: Partial<ChartOptions>;
  public cmmtssByRespCodeOptions: Partial<ChartOptions>; // Comments by response code chart options

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formBuilder: RxFormBuilder,
    private analyticsDashboardDataService: AnalyticsDashboardDataService
  ) {
  }

  ngOnInit() {
    this.analyticsData.set(this.route.snapshot.data['analyticsData']);
    console.log('Analytics data loaded:', this.analyticsData());
    this.selectedPlan = this.planFilterOptions[0]?.value;
    this.startDate = DateTime.fromISO(FOM_GO_LIVE_DATE).startOf('day').toJSDate();
    this.endDate = new Date();

    this.initCommentsByResponseCodeChartOptions();
  }

  async ngAfterViewInit() {
    // Implement a delay before setting isInitialized to true
    await new Promise(resolve => setTimeout(resolve, 1000)); // 500ms delay
    this.isInitialized = true;
  }

  onDateChange(type: 'startDate' | 'endDate', value: Date) {
    const formatted = value ? DateTime.fromJSDate(value).toFormat(DEFAULT_ISO_DATE_FORMAT) : '';
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
    const limit = 15; // TODO, implement this, not hardcoded.
    console.log('Fetching analytics data with params:', { startDateStr, endDateStr, selectedPlan, limit });
    this.analyticsDashboardDataService.getAnalyticsData(startDateStr, endDateStr, selectedPlan, limit)
      .subscribe(data => {
        this.analyticsData.set(data);
        console.log("Analytics data loaded:", this.analyticsData());
    });
  }

  ngOnDestroy() {
    // this.ngUnsubscribe.next();
    // this.ngUnsubscribe.complete();
  }

  initCommentsByResponseCodeChartOptions() {
    this.cmmtssByRespCodeOptions = {
      title: {
        text: "Total comments received by category"
      },
      series: [
        {
          name: "Comments by Response Code",
          data: [480, 118, 90]
        }
      ],
      chart: {
        type: "bar",
        height: 380
      },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: "55%",
          dataLabels: {
            position: "top" // top, center, bottom
          }
        }
      },
      dataLabels: {
        enabled: true,
        formatter: function(val) {
          return val as number;
        },
        offsetY: -20,
        style: {
          fontSize: "12px",
          colors: ["#304758"]
        }
      },
      xaxis: {
        categories: [
          "Considered",
          "Addressed",
          "Not applicable"
        ],
        title: {
          text: "Comment category",
          style: {
            cssClass: "chart-title-label"
          }
        }
      },
      yaxis: {
        title: {
          text: "Number of comments",
          style: {
            cssClass: "chart-title-label"
          }
        }
      },
      fill: {
        opacity: 1,
        colors: ["#123B64"]
      }
    };
  }

}
