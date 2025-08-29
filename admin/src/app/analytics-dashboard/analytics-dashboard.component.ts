import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';

import { DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { RxFormBuilder } from '@rxweb/reactive-form-validators';

import { UploadBoxComponent } from '@admin-core/components/file-upload-box/file-upload-box.component';
import { AppFormControlDirective } from '@admin-core/directives/form-control.directive';
import { NewlinesPipe } from '@admin-core/pipes/newlines.pipe';
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
  analyticsData: any;
  startDate: string = '';
  endDate: string = '';
  filterOptions = [
    { value: ProjectPlanCodeFilterEnum.Fsp, label: 'FSP' },
    { value: ProjectPlanCodeFilterEnum.Woodlot, label: 'Woodlot' },
    { value: ProjectPlanCodeFilterEnum.All, label: 'All' }
  ];
  selectedFilter: string = this.filterOptions[0]?.value || '';
  minStartDate: Date = DateTime.fromISO('2024-04-01T00:00:00').toJSDate();
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formBuilder: RxFormBuilder
  ) {
  }

  ngOnInit() {
    this.analyticsData = this.route.snapshot.data['analyticsData'];
    this.selectedFilter = this.filterOptions[0]?.value || '';
  }

  ngAfterViewInit() {
  }

  ngOnDestroy() {
    // this.ngUnsubscribe.next();
    // this.ngUnsubscribe.complete();
  }

}
