import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';

import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { DateTime } from "luxon";
import { Observable, Subject } from 'rxjs';

import { AttachmentResolverSvc } from "@admin-core/services/AttachmentResolverSvc";
import { CognitoService } from "@admin-core/services/cognito.service";
import { ModalService } from '@admin-core/services/modal.service';
import { StateService } from '@admin-core/services/state.service';
import { AttachmentUploadService } from "@admin-core/utils/attachmentUploadService";
import { DEFAULT_ISO_DATE_FORMAT, MAX_FILEUPLOAD_SIZE } from '@admin-core/utils/constants';
import { DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import {
    AttachmentResponse, DistrictResponse, ForestClientResponse,
    ForestClientService,
    ProjectPlanCodeEnum,
    ProjectResponse,
    ProjectService
} from '@api-client';
import { RxFormBuilder, RxFormGroup } from '@rxweb/reactive-form-validators';
import { User } from "@utility/security/user";

import { UploadBoxComponent } from '@admin-core/components/file-upload-box/file-upload-box.component';
import { AppFormControlDirective } from '@admin-core/directives/form-control.directive';
import { ICodeTable } from '@admin-core/models/code-tables';
import { NewlinesPipe } from '@admin-core/pipes/newlines.pipe';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BsDatepickerConfig, BsDatepickerModule } from 'ngx-bootstrap/datepicker';

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
  readonly projectPlanCodeEnum = ProjectPlanCodeEnum;
  readonly DEFAULT_ISO_DATE_FORMAT = DEFAULT_ISO_DATE_FORMAT;
  fg: RxFormGroup;
  state: ApplicationPageType;
  originalProjectResponse: ProjectResponse;
  districts: DistrictResponse[] = this.stateSvc.getCodeTable('district');
  projectPlanOptions: ICodeTable[] = [
    {"code": this.projectPlanCodeEnum.Fsp, "description": "Forest Stewardship Plan"},
    {"code": this.projectPlanCodeEnum.Woodlot, "description": "Woodlot Licence Plan"}
  ];
  forestClients: ForestClientResponse[] = [];
  public publicNotice: File = null;
  publicNoticeContent: any;
  public supportingDocument: File = null;
  supportingDocContent: any;
  public districtIdSelect: any = null;
  public forestClientSelect: any = null;
  public isInitialState: boolean = true;
  public isCommentingOpenState: boolean = false;
  public isCommentingClosedState: boolean = false;
  public isPublishState: boolean = false;
  maxFileSize: number = MAX_FILEUPLOAD_SIZE.DOCUMENT;
  public isSubmitSaveClicked = false;
  public descriptionValue: string = null;
  public user: User;
  public attachments: AttachmentResponse[] = [];
  public attachmentsInitialNotice: AttachmentResponse[] = [];
  public isDeleting = false;
  public minOpeningDate: Date = DateTime.now().plus({days: 1}).toJSDate(); // 1 day in the future.
  public minClosedDate: Date;
  public fileTypesParentInitial: string[] =
    ['image/png', 'image/jpeg', 'image/jpg', 'image/tiff',
      'image/x-tiff', 'application/pdf']

  public fileTypesParentSupporting: string[] =
    ['application/pdf', 'image/jpg', 'image/jpeg', 'text/csv', 'image/png', 'text/plain',
     'application/rtf', 'image/tiff', 'application/msword',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]

  public descriptionLimit: number = 500; // Based on project.dto.ts for limit.

  private scrollToFragment: string = null;
  private snackBarRef: MatSnackBarRef<SimpleSnackBar> = null;
  private ngUnsubscribe: Subject<void> = new Subject<void>();

  // bsDatepicker config object
  readonly bsConfig = {
    dateInputFormat: 'YYYY',
    minMode: 'year',
    minDate: DateTime.now().toJSDate(),
    maxDate: DateTime.now().plus({years: 7}).toJSDate(), // current + 7 years
    containerClass: 'theme-dark-blue'
  } as Partial<BsDatepickerConfig>

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public snackBar: MatSnackBar,
    private projectSvc: ProjectService,
    public attachmentResolverSvc: AttachmentResolverSvc,
    private attachmentUploadSvc: AttachmentUploadService,
    private formBuilder: RxFormBuilder,
    public stateSvc: StateService,
    private modalSvc: ModalService,
    private datePipe: DatePipe,
    private forestSvc: ForestClientService,
    private cognitoService: CognitoService
  ) {
    this.user = this.cognitoService.getUser();
  }

  get isLoading() {
    return this.stateSvc.loading;
  }

  // check for unsaved changes before navigating away from current route (ie, this page)
  public canDeactivate(): Observable<boolean> | boolean {
    if (!this.fg) {
      return true;
    }

    // allow synchronous navigation if everything is OK
    if (!this.fg.dirty && !this.fg.isModified) {
      return true;
    }

    return false;
  }

  public backToSearch() {
    this.router.navigate(['/search']);
  }

  ngOnInit() {

  }

  ngAfterViewInit() {
    // if requested, scroll to specified section
    if (this.scrollToFragment) {
      // ensure element exists
      const element = document.getElementById(this.scrollToFragment);
      if (element) {
        element.scrollIntoView();
      }
    }
  }

  ngOnDestroy() {
    // dismiss any open snackbar
    if (this.snackBarRef) {
      this.snackBarRef.dismiss();
    }

    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

  validate() {
    if (!this.fg.valid) {
      this.fg.markAllAsTouched();
      this.fg.updateValueAndValidity({onlySelf: false, emitEvent: true});
      this.modalSvc.openWarningDialog('Please review the highlighted fields ');
    }
    return this.fg.valid;
  }
  
  onSuccess(id: number) {
    this.router.navigate([`a/${id}`])
  }

  getformatedDate(field, format = 'yyyy') {
    const fieldVal = this.fg.get(field).value;
    if (typeof fieldVal === "string") {
        return DateTime.fromISO(fieldVal).toFormat(format)
    }
    else if (fieldVal instanceof Date) {
        return DateTime.fromJSDate(fieldVal).toFormat(format);
    }
  }

}
