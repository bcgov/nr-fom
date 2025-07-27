import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';

import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { DateTime } from "luxon";
import { Observable, Subject, of } from 'rxjs';
import { switchMap, takeUntil, tap } from 'rxjs/operators';

import { AttachmentTypeEnum } from "@admin-core/models/attachmentTypeEnum";
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
    ProjectCreateRequest,
    ProjectPlanCodeEnum,
    ProjectResponse,
    ProjectService, WorkflowStateEnum
} from '@api-client';
import { RxFormBuilder, RxFormGroup } from '@rxweb/reactive-form-validators';
import { User } from "@utility/security/user";
import { FomAddEditForm } from './fom-add-edit.form';

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
    selector: 'app-application-add-edit',
    templateUrl: './fom-add-edit.component.html',
    styleUrls: ['./fom-add-edit.component.scss'],
    providers: [DatePipe]
})
export class FomAddEditComponent implements OnInit, AfterViewInit, OnDestroy {
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
  public supportingDocuments: any[] = [];
  public initialPublicDocument: any[] = [];
  public districtIdSelect: any = null;
  public forestClientSelect: any = null;
  public isInitialState: boolean = true;
  public isCommentingOpenState: boolean = false;
  public isCommentingClosedState: boolean = false;
  public isPublishState: boolean = false;
  files: any[] = [];
  maxFileSize: number = MAX_FILEUPLOAD_SIZE.DOCUMENT;
  publicNoticeContent: any;
  supportingDocContent: any;
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

  get isCreate() {
    return this.state === 'create';
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

  public cancelChanges() {
    // can't call location back() - fails when cancel is cancelled due to dirty form or unsaved documents multiple times
    const routerFragment = this.isCreate ? ['/search'] : ['/a', this.originalProjectResponse.id]

    this.router.navigate(routerFragment);

  }

  ngOnInit() {

    this.route.url.pipe(takeUntil(this.ngUnsubscribe), switchMap(url => {
        this.state = url[1].path === 'create' ? 'create' : 'edit';
        return this.isCreate ? of({}) : this.projectSvc.projectControllerFindOne(this.route.snapshot.params.appId);
      }
    )).subscribe((data: ProjectResponse) => {
      if (!this.isCreate) {
        this.originalProjectResponse = data;
        if (data.district) {
          this.districtIdSelect = this.originalProjectResponse.district.id;
        }

        this.forestClientSelect = this.originalProjectResponse.forestClient.id;
        this.isInitialState = this.originalProjectResponse.workflowState.code === WorkflowStateEnum.Initial;
        this.isCommentingOpenState = this.originalProjectResponse.workflowState.code === WorkflowStateEnum.CommentOpen;
        this.isCommentingClosedState = this.originalProjectResponse.workflowState.code === WorkflowStateEnum.CommentClosed;
        this.isPublishState = this.originalProjectResponse.workflowState.code === WorkflowStateEnum.Published;

        this.attachmentResolverSvc.getAttachments(this.originalProjectResponse.id)
          .then( (result) => {
            for(const attachmentResponse of result ) {
              if(attachmentResponse.attachmentType.code === AttachmentTypeEnum.PUBLIC_NOTICE)
                this.attachmentsInitialNotice.push(attachmentResponse);
              else
                this.attachments.push(attachmentResponse);
            }
          }).catch((error) => {
          console.error(error);
        });
      }
      const form = new FomAddEditForm(data);
      this.fg = <RxFormGroup>this.formBuilder.formGroup(form);
      this.initializeFormFields(this.fg, this.user, this.originalProjectResponse);
      if(data.description) {
        this.descriptionValue = data.description;
      }

      this.loadForestClients().then( (result) => {
        this.forestClients = result;
      }).catch((error)=> {
        console.error(error);
      });
    });
  }

  async loadForestClients (): Promise<ForestClientResponse[]> {
   return this.forestSvc.forestClientControllerFind().toPromise()
}

  addNewFileInitialPublic(newFiles: any[]) {
    this.initialPublicDocument = [newFiles];
  }

  addNewFileSupporting(newFiles: any[]) {
    this.supportingDocuments = [newFiles];
  }

  getContentFileFromUpload(fileContent: any) {
    this.publicNoticeContent = fileContent;
  }

  getContentFileSupportingDoc(fileContent: any) {
    this.supportingDocContent = fileContent;
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

  submit() {
    this.isSubmitSaveClicked = true;
    this.validate();
    if (!this.fg.valid) return;
    if (this.stateSvc.loading) return;
    let projectCreate = this.fg.value as ProjectCreateRequest
    projectCreate['districtId'] = this.districtIdSelect;
    projectCreate.forestClientNumber = this.fg.get('forestClient').value.id;
    const cmoDateIsoVal = this.getformatedDate('commentingOpenDate', this.DEFAULT_ISO_DATE_FORMAT);
    const cmcDateIsoVal = this.getformatedDate('commentingClosedDate', this.DEFAULT_ISO_DATE_FORMAT);
    projectCreate.commentingOpenDate = cmoDateIsoVal? cmoDateIsoVal: null;
    projectCreate.commentingClosedDate = cmcDateIsoVal? cmcDateIsoVal: null;
    projectCreate.operationStartYear = DateTime.fromJSDate(this.fg.get('opStartDate').value).year;
    projectCreate.operationEndYear = DateTime.fromJSDate(this.fg.get('opEndDate').value).year;

    this.projectSvc.projectControllerCreate(projectCreate)
        .toPromise()
        .then(result => this.onSuccess(result.id))
        .catch(err => console.error(err));
  }

  onSuccess(id: number) {
    this.router.navigate([`a/${id}`])
  }

  async saveApplication() {
    this.isSubmitSaveClicked = true;
    this.validate();
    const {id, forestClient, workflowState, ...rest} = this.originalProjectResponse;
    let projectUpdateRequest = {...rest, ...this.fg.value}
    projectUpdateRequest['districtId'] = projectUpdateRequest.district;

    if (!this.fg.valid) return;
    try {
      const cmoDateIsoVal = this.getformatedDate('commentingOpenDate', this.DEFAULT_ISO_DATE_FORMAT);
      const cmcDateIsoVal = this.getformatedDate('commentingClosedDate', this.DEFAULT_ISO_DATE_FORMAT);
      projectUpdateRequest.commentingOpenDate = cmoDateIsoVal? cmoDateIsoVal: null;
      projectUpdateRequest.commentingClosedDate = cmcDateIsoVal? cmcDateIsoVal: null;
      projectUpdateRequest.operationStartYear = DateTime.fromJSDate(this.fg.get('opStartDate').value).year;
      projectUpdateRequest.operationEndYear = DateTime.fromJSDate(this.fg.get('opEndDate').value).year;

      await this.projectSvc.projectControllerUpdate(id, projectUpdateRequest).toPromise();

      let file: any = null;
      let fileContent: any = null;

      if(this.initialPublicDocument.length > 0){
        file = this.initialPublicDocument[0];
        fileContent = new Blob([this.publicNoticeContent], {type: file.type});

        await this.attachmentUploadSvc
          .attachmentCreate(file, fileContent, id,
            AttachmentTypeEnum.PUBLIC_NOTICE).pipe(tap(obs => console.log(obs))).toPromise();

      }

      if (this.supportingDocuments.length > 0){
        file = this.supportingDocuments[0];
        fileContent = new Blob([this.supportingDocContent], {type: file.type});
        await this.attachmentUploadSvc
          .attachmentCreate(file, fileContent, id,
            AttachmentTypeEnum.SUPPORTING_DOC).pipe(tap(obs => console.log(obs))).toPromise();
      }

      return this.onSuccess(id);
    } catch (err) {
      console.error(err);
    }

  }

  changeDistrictId(e) {
    this.fg.get('district').setValue(parseInt(e.target.value));
    this.districtIdSelect = parseInt(e.target.value);
  }

  onProjectPlanChange(e) {
    // reset fspId and woodlotLicenseNumber fields when plan selection changed.
    this.fg.get('fspId').setValue(null)
    this.fg.get('woodlotLicenseNumber').setValue(null)
  }
  onForestClientChange(e) {
    const forestClientField = this.fg.get('forestClient');
    this.fg.get('forestClient').setValue(forestClientField.value);
    this.forestClientSelect = parseInt(forestClientField.value.id);

    // 'TIMBER SALES MANAGER' name field is required (to be validated) based on forestClient name
    // conditionally. Due to it's validation is annotation-based in fom-add-edit.form.ts
    // (using @rxweb/reactive-form-validators), when forestClient is changed, bctsMgrName does not get
    // rerenderred (no ngIf, ngFor etc on this field).
    // Just trigger the dynamic form field (with enable()) is probably easier than using 'ChangeDetectorRef'.
    this.fg.get('bctsMgrName').enable();
  }

  isHolderBctsManger() {
    const forestClientField = this.fg.get('forestClient');
    return forestClientField.value?.name?.toUpperCase().includes('TIMBER SALES MANAGER');
  }

  changeDescription(e) {
    this.descriptionValue = e.target.value;
    if(!this.descriptionValue && !this.isCreate){
      this.fg.get('description').setErrors({incorrect: true})
    }
  }

 /*
  * Closed Date cannot be before (30 days after Comment Opening Date)
  * if FOM status is in 'Commenting Open".
  */
  validateClosedDate(closedDate: Date): void {
    if (!closedDate) return;

    const commentingOpenDateField = this.fg.get('commentingOpenDate');
    const defaultClosedDate = DateTime.fromJSDate(commentingOpenDateField.value).plus({days: 30});
    const diff = DateTime.fromJSDate(closedDate).diff(defaultClosedDate, 'days');
    if (diff.days < 0 ) {
      const originalOpenDate = this.originalProjectResponse?.commentingOpenDate;
      if (this.isCreate || !this.isCreate && (originalOpenDate && originalOpenDate
        !== DateTime.fromJSDate(commentingOpenDateField.value).toISODate())) {
        this.modalSvc.openWarningDialog(`Commenting Closed Date cannot be before ${defaultClosedDate.toISODate()}`);
      }

      if (!this.isCreate) {
        const closeDatePipe = this.datePipe.transform(this.originalProjectResponse.commentingClosedDate, DEFAULT_ISO_DATE_FORMAT);
        this.fg.get('commentingClosedDate').setValue(closeDatePipe)
      }
      else {
        this.fg.get('commentingClosedDate').setValue(null);
      }
    }
  }

  toggleClosedDate(newCommentingOpenDate: Date): void {
    const commentingClosedDateField = this.fg.get('commentingClosedDate');
    // Only enable commenting_closed_date when commenting_open_date is present.
    if (newCommentingOpenDate) {
      commentingClosedDateField.enable();
      this.validateClosedDate(commentingClosedDateField.value? DateTime.fromJSDate(commentingClosedDateField.value).toJSDate(): null);

      // disable past date at closedDate selection less than 30 days after commentingOpenDate
      this.minClosedDate = DateTime.fromJSDate(newCommentingOpenDate).plus({days: 30}).toJSDate();
    }
    else {
      commentingClosedDateField.disable();
      commentingClosedDateField.setValue(null);
    }
  }

  public isCreateAttachmentAllowed() {
    return this.originalProjectResponse.workflowState.code === WorkflowStateEnum.Initial
    || this.originalProjectResponse.workflowState.code === WorkflowStateEnum.CommentOpen
    || this.originalProjectResponse.workflowState.code === WorkflowStateEnum.CommentClosed
  }

  public deleteAttachment(id: number) {
    const dialogRef = this.modalSvc.openConfirmationDialog(`You are about to delete this attachment. Are you sure?`, 'Delete Attachment');
    dialogRef.afterClosed().subscribe((confirm) => {
      if (confirm) {
        let result = this.attachmentResolverSvc.attachmentControllerRemove(id);
        result.then( () => {
          return this.onSuccessAttachment(this.originalProjectResponse.id);
        }).catch( (error) => {
          console.error(error);
        })
      }
    })
  }

  onSuccessAttachment(id: number) {
    this.router.navigate([`a/${id}/edit`])
      .then( () => {
        window.location.reload();
      })

  }

  public isDeleteAttachmentAllowed(attachment: AttachmentResponse) {
    return this.attachmentResolverSvc.isDeleteAttachmentAllowed(attachment.attachmentType.code, this.originalProjectResponse.workflowState.code);
  }

  getProjectPlanDesc() {
    const item = this.projectPlanOptions.filter((item) => {
        return item.code == this.originalProjectResponse.projectPlanCode
    })[0]["description"];
    return item;
  }

  getDistrictDesc(districtId) {
    const desc = this.districts.filter((item) => {
        return item.id == districtId
    })[0]["name"];
    return desc;
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

  /**
   * Additional setup for form control.
   */
  private initializeFormFields(fg: RxFormGroup, user: User, project: ProjectResponse) {
    const workflowStateCode = project?.workflowState.code;

    // Converting commentingOpenDate date to 'yyyy-MM-dd'
    const commentingOpenDateField = fg.get('commentingOpenDate');
    const openDatePipe = this.datePipe.transform(fg.value.commentingOpenDate, DEFAULT_ISO_DATE_FORMAT);
    commentingOpenDateField.setValue(openDatePipe);

    // Commenting open can only be edited before publish.
    if (workflowStateCode && WorkflowStateEnum.Initial != workflowStateCode) {
      commentingOpenDateField.disable();
    }

    // Converting commentingClosedDate date to 'yyyy-MM-dd'
    const commentingClosedDateField = fg.get('commentingClosedDate');
    const closeDatePipe = this.datePipe.transform(fg.value.commentingClosedDate, DEFAULT_ISO_DATE_FORMAT);
    commentingClosedDateField.setValue(closeDatePipe);
    if ((user.isMinistry && !user.isForestClient) ||
        commentingOpenDateField.value == null) {
      commentingClosedDateField.disable();
    }

    fg.get('district').setValue(project?.district.id);
  }

  getErrorMessage(controlName: string, messageKey: string = null): string {
    const errors = this.fg.controls[controlName]?.errors;
    if (errors !== null) {
      const { [messageKey]: messages } = errors;
      if (messages) return messages.message;
    }
    return null;
  }

  fieldTouchedOrDirty(controlName: string): boolean {
    const control = this.fg.controls[controlName];
    return control?.touched || control?.dirty;
  }

}
