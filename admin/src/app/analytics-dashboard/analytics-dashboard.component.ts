import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';

import { DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { RxFormBuilder } from '@rxweb/reactive-form-validators';

import { UploadBoxComponent } from '@admin-core/components/file-upload-box/file-upload-box.component';
import { AppFormControlDirective } from '@admin-core/directives/form-control.directive';
import { NewlinesPipe } from '@admin-core/pipes/newlines.pipe';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';

type ApplicationPageType = 'create' | 'edit';

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
        UploadBoxComponent
    ],
    selector: 'app-analytics-dashboard',
    templateUrl: './analytics-dashboard.component.html',
    styleUrls: ['./analytics-dashboard.component.scss'],
    providers: [DatePipe]
})
export class AnalyticsDashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formBuilder: RxFormBuilder
  ) {
  }

  public backToSearch() {
    this.router.navigate(['/search']);
  }

  ngOnInit() {

  }

  ngAfterViewInit() {
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

}
