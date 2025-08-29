import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';

import { signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { RxFormBuilder } from '@rxweb/reactive-form-validators';

import { UploadBoxComponent } from '@admin-core/components/file-upload-box/file-upload-box.component';
import { AppFormControlDirective } from '@admin-core/directives/form-control.directive';
import { NewlinesPipe } from '@admin-core/pipes/newlines.pipe';
import { FOM_GO_LIVE_DATE } from '@admin-core/utils/constants';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ProjectPlanCodeFilterEnum } from '@api-client';
import { DateTime } from 'luxon';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';

@Component({
    standalone: true,
    imports: [
      NgIf,
      FormsModule,
      ReactiveFormsModule,
      BsDatepickerModule,
      NgClass,
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
  onPlanFilterChange(value: string) {
    this.selectedFilter = value;
    this.fetchAnalyticsData();
  }
  analyticsData = signal<any>(null);
  startDate: Date = DateTime.fromISO(FOM_GO_LIVE_DATE).startOf('day').toJSDate();
  endDate: Date = new Date();
  planFilterOptions = [
    { value: ProjectPlanCodeFilterEnum.Fsp, label: 'FSP' },
    { value: ProjectPlanCodeFilterEnum.Woodlot, label: 'Woodlot' },
    { value: ProjectPlanCodeFilterEnum.All, label: 'All' }
  ];
  selectedFilter: string = this.planFilterOptions[0]?.value || '';
  minStartDate: Date = DateTime.fromISO(FOM_GO_LIVE_DATE).startOf('day').toJSDate();
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formBuilder: RxFormBuilder
  ) {
  }

  ngOnInit() {
    this.analyticsData.set(this.route.snapshot.data['analyticsData']);
    this.selectedFilter = this.planFilterOptions[0]?.value || '';
  }

  onDateChange(type: 'startDate' | 'endDate', value: Date) {
    // Convert Date to string in 'YYYY-MM-DD' format
    const formatted = value ? DateTime.fromJSDate(value).toFormat('yyyy-MM-dd') : '';
    if (type === 'startDate') {
      this.startDate = value;
    } else if (type === 'endDate') {
      this.endDate = value;
    }
    // Fetch new analytics data from backend
    this.fetchAnalyticsData();
  }

  fetchAnalyticsData() {
    // TODO: Replace with actual API call
    // Example: this.analyticsService.getAnalytics(this.startDate, this.endDate, this.selectedFilter)
    //   .subscribe(data => this.analyticsData.set(data));
    // For now, just log to console
    console.log('Fetching analytics data for:', this.startDate, this.endDate, this.selectedFilter);
    // Simulate fetch
    // this.analyticsData.set(mockData);
  }

  ngAfterViewInit() {
  }

  ngOnDestroy() {
    // this.ngUnsubscribe.next();
    // this.ngUnsubscribe.complete();
  }

}
