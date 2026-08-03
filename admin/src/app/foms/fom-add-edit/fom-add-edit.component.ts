import { AfterViewInit, Component, DestroyRef, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { DateTime } from "luxon";
import { Observable, lastValueFrom, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

import { AttachmentTypeEnum } from "@admin-core/models/attachmentTypeEnum";
import { AttachmentResolverSvc } from "@admin-core/services/AttachmentResolverSvc";
import { CognitoService } from "@admin-core/services/cognito.service";
import { ModalService } from '@admin-core/services/modal.service';
import { StateService } from '@admin-core/services/state.service';
import { LoadingService } from '@admin-core/services/loading.service';
import { AttachmentUploadService } from "@admin-core/utils/attachmentUploadService";
import { DEFAULT_ISO_DATE_FORMAT, MAX_FILEUPLOAD_SIZE } from '@admin-core/utils/constants';
import { DatePipe } from '@angular/common';
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
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BsDatepickerConfig, BsDatepickerModule } from 'ngx-bootstrap/datepicker';

type ApplicationPageType = 'create' | 'edit';

@Component({
    imports: [
    FormsModule,
    ReactiveFormsModule,
    BsDatepickerModule,
    AppFormControlDirective,
    UploadBoxComponent
],
    selector: 'app-application-add-edit',
    templateUrl: './fom-add-edit.component.html',
    styleUrl: './fom-add-edit.component.scss',
    providers: [DatePipe]
})
export class FomAddEditComponent implements OnInit, AfterViewInit, OnDestroy {
  private router = inject(Router);
  snackBar = inject(MatSnackBar);
  private projectSvc = inject(ProjectService);
  attachmentResolverSvc = inject(AttachmentResolverSvc);
  private attachmentUploadSvc = inject(AttachmentUploadService);
  private formBuilder = inject(RxFormBuilder);
  stateSvc = inject(StateService);
  loadingSvc = inject(LoadingService);
  private modalSvc = inject(ModalService);
  private datePipe = inject(DatePipe);
  private forestSvc = inject(ForestClientService);
  private cognitoService = inject(CognitoService);
  private destroyRef = inject(DestroyRef);

  readonly projectPlanCodeEnum = ProjectPlanCodeEnum;
  readonly DEFAULT_ISO_DATE_FORMAT = DEFAULT_ISO_DATE_FORMAT;
  fg: RxFormGroup;
  /**
   * Flips once the form group has been built from the loaded FOM. `fg` itself stays a plain field —
   * it is built once and never replaced — so this signal is what tells the template the form, and the
   * workflow-state flags set alongside it, are ready to render.
   */
  readonly formReady = signal(false);
  // Route-bound inputs: `mode` from route data (create/edit), `appId` param (edit route only).
  readonly mode = input.required<ApplicationPageType>();
  readonly appId = input<string>();
  state: ApplicationPageType;
  originalProjectResponse: ProjectResponse;
  districts: DistrictResponse[] = this.stateSvc.getCodeTable('district');
  projectPlanOptions: ICodeTable[] = [
    {"code": this.projectPlanCodeEnum.Fsp, "description": "Forest Stewardship Plan"},
    {"code": this.projectPlanCodeEnum.Woodlot, "description": "Woodlot Licence Plan"}
  ];
  readonly forestClients = signal<ForestClientResponse[]>([]);
  public publicNotice: File | null = null;
  public supportingDocument: File | null = null;
  public districtIdSelect: any = null;
  public forestClientSelect: any = null;
  public isInitialState: boolean = true;
  public isCommentingOpenState: boolean = false;
  public isCommentingClosedState: boolean = false;
  public isPublishState: boolean = false;
  maxFileSize: number = MAX_FILEUPLOAD_SIZE.DOCUMENT;
  public isSubmitSaveClicked = false;
  public descriptionValue: string | null = null;
  // Populated from the authenticated Cognito session in the constructor.
  public user!: User;
  public readonly attachments = signal<AttachmentResponse[]>([]);
  public readonly attachmentsInitialNotice = signal<AttachmentResponse[]>([]);
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

  private scrollToFragment: string | null = null;
  private snackBarRef: MatSnackBarRef<SimpleSnackBar> | null = null;

  // bsDatepicker config object
  readonly bsConfig = {
    dateInputFormat: 'YYYY',
    minMode: 'year',
    minDate: DateTime.now().toJSDate(),
    maxDate: DateTime.now().plus({years: 7}).toJSDate(), // current + 7 years
    containerClass: 'theme-dark-blue'
  } as Partial<BsDatepickerConfig>

  constructor() {
    const user = this.cognitoService.getUser();
    if (user) {
      this.user = user;
    }
  }

  get isCreate() {
    return this.state === 'create';
  }

  get isLoading() {
    return this.loadingSvc.loading();
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
    this.state = this.mode();
    // Create mode emits an unused placeholder (the subscribe body only reads `data` when !isCreate).
    const load$ = this.isCreate ? of({} as ProjectResponse) : this.projectSvc.projectControllerFindOne(Number(this.appId()));
    load$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data: ProjectResponse) => {
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
            const initialNotice: AttachmentResponse[] = [];
            const supporting: AttachmentResponse[] = [];
            for(const attachmentResponse of result ) {
              if(attachmentResponse.attachmentType.code === AttachmentTypeEnum.PUBLIC_NOTICE)
                initialNotice.push(attachmentResponse);
              else
                supporting.push(attachmentResponse);
            }
            // Replace rather than mutate: a signal holding a mutated array does not notify.
            this.attachmentsInitialNotice.set(initialNotice);
            this.attachments.set(supporting);
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

      this.formReady.set(true);

      this.loadForestClients().then( (result) => {
        this.forestClients.set(result);
      }).catch((error)=> {
        console.error(error);
      });
    });
  }

  async loadForestClients (): Promise<ForestClientResponse[]> {
    return await lastValueFrom(
      this.forestSvc.forestClientControllerFind()
    );
  }

  onFileEmitForPublicNotice(newFile: File | null) {
    this.publicNotice = newFile;
  }

  onFileEmitForSupportingDocument(newFile: File | null) {
    this.supportingDocument = newFile;
    this.supportingDocument = newFile;
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
    if (this.loadingSvc.loading()) return;
    const projectCreate = this.fg.value as ProjectCreateRequest
    projectCreate['districtId'] = this.districtIdSelect;
    projectCreate.forestClientNumber = this.fg.get('forestClient')?.value.id;
    const cmoDateIsoVal = this.getformatedDate('commentingOpenDate', this.DEFAULT_ISO_DATE_FORMAT);
    const cmcDateIsoVal = this.getformatedDate('commentingClosedDate', this.DEFAULT_ISO_DATE_FORMAT);
    // commentingOpenDate/ClosedDate are non-optional strings in the generated type but the backend
    // accepts null when no date is set; `null!` keeps the null runtime value the API expects.
    projectCreate.commentingOpenDate = cmoDateIsoVal? cmoDateIsoVal: null!;
    projectCreate.commentingClosedDate = cmcDateIsoVal? cmcDateIsoVal: null!;
    projectCreate.operationStartYear = DateTime.fromJSDate(this.fg.get('opStartDate')?.value).year;
    projectCreate.operationEndYear = DateTime.fromJSDate(this.fg.get('opEndDate')?.value).year;
    
    lastValueFrom(
      this.projectSvc.projectControllerCreate(projectCreate).pipe(
        tap((result) => {
          this.onSuccess(result.id);
        }),
        catchError((error) => {
          console.error(error);
          return of(null);
        })
      )
    );
  }

  onSuccess(id: number) {
    this.router.navigate([`a/${id}`])
  }

  async saveApplication() {
    this.isSubmitSaveClicked = true;
    this.validate();
    const {id, forestClient, workflowState, ...rest} = this.originalProjectResponse;
    const projectUpdateRequest = {...rest, ...this.fg.value}
    projectUpdateRequest['districtId'] = projectUpdateRequest.district;

    if (!this.fg.valid) return;

    try {
      const cmoDateIsoVal = this.getformatedDate('commentingOpenDate', this.DEFAULT_ISO_DATE_FORMAT);
      const cmcDateIsoVal = this.getformatedDate('commentingClosedDate', this.DEFAULT_ISO_DATE_FORMAT);
      projectUpdateRequest.commentingOpenDate = cmoDateIsoVal? cmoDateIsoVal: null;
      projectUpdateRequest.commentingClosedDate = cmcDateIsoVal? cmcDateIsoVal: null;
      projectUpdateRequest.operationStartYear = DateTime.fromJSDate(this.fg.get('opStartDate')?.value).year;
      projectUpdateRequest.operationEndYear = DateTime.fromJSDate(this.fg.get('opEndDate')?.value).year;

      await lastValueFrom(this.projectSvc.projectControllerUpdate(id, projectUpdateRequest));

      if(this.publicNotice){
        const file = this.publicNotice;
        await lastValueFrom(this.attachmentUploadSvc
          .attachmentCreate(file, file, id,
            AttachmentTypeEnum.PUBLIC_NOTICE).pipe(tap(obs => console.log(obs))));

      }

      if (this.supportingDocument){
        const file = this.supportingDocument;
        await lastValueFrom(this.attachmentUploadSvc
          .attachmentCreate(file, file, id,
            AttachmentTypeEnum.SUPPORTING_DOC).pipe(tap(obs => console.log(obs))));
      }

      return this.onSuccess(id);
    } catch (err) {
      console.error(err);
    }
  }

  changeDistrictId(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    this.fg.get('district')?.setValue(parseInt(value));
    this.districtIdSelect = parseInt(value);
  }

  onProjectPlanChange(e: Event) {
    // reset fspId and woodlotLicenseNumber fields when plan selection changed.
    this.fg.get('fspId')?.setValue(null)
    this.fg.get('woodlotLicenseNumber')?.setValue(null)
  }
  onForestClientChange(e: Event) {
    const forestClientField = this.fg.get('forestClient');
    if (!forestClientField) {
      return;
    }
    forestClientField.setValue(forestClientField.value);
    this.forestClientSelect = parseInt(forestClientField.value.id);

    // 'TIMBER SALES MANAGER' name field is required (to be validated) based on forestClient name
    // conditionally. Due to it's validation is annotation-based in fom-add-edit.form.ts
    // (using @rxweb/reactive-form-validators), when forestClient is changed, bctsMgrName does not get
    // rerenderred (no ngIf, ngFor etc on this field).
    // Just trigger the dynamic form field (with enable()) is probably easier than using 'ChangeDetectorRef'.
    this.fg.get('bctsMgrName')?.enable();
  }

  isHolderBctsManger() {
    const forestClientField = this.fg.get('forestClient');
    return forestClientField?.value?.name?.toUpperCase().includes('TIMBER SALES MANAGER');
  }

  changeDescription(e: Event) {
    this.descriptionValue = (e.target as HTMLTextAreaElement).value;
    if(!this.descriptionValue && !this.isCreate){
      this.fg.get('description')?.setErrors({incorrect: true})
    }
  }

 /*
  * Closed Date cannot be before (30 days after Comment Opening Date)
  * if FOM status is in 'Commenting Open".
  */
  validateClosedDate(closedDate: Date | null): void {
    if (!closedDate) return;

    const commentingOpenDateField = this.fg.get('commentingOpenDate');
    if (!commentingOpenDateField) return;
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
        this.fg.get('commentingClosedDate')?.setValue(closeDatePipe)
      }
      else {
        this.fg.get('commentingClosedDate')?.setValue(null);
      }
    }
  }

  toggleClosedDate(newCommentingOpenDate: Date): void {
    const commentingClosedDateField = this.fg.get('commentingClosedDate');
    if (!commentingClosedDateField) return;
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
        const result = this.attachmentResolverSvc.attachmentControllerRemove(id);
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

  getDistrictDesc(districtId: number) {
    const desc = this.districts.filter((item) => {
        return item.id == districtId
    })[0]["name"];
    return desc;
  }

  getformatedDate(field: string, format = 'yyyy') {
    const fieldVal = this.fg.get(field)?.value;
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
    if (!commentingOpenDateField) return;
    const openDatePipe = this.datePipe.transform(fg.value.commentingOpenDate, DEFAULT_ISO_DATE_FORMAT);
    commentingOpenDateField.setValue(openDatePipe);

    // Commenting open can only be edited before publish.
    if (workflowStateCode && WorkflowStateEnum.Initial != workflowStateCode) {
      commentingOpenDateField.disable();
    }

    // Converting commentingClosedDate date to 'yyyy-MM-dd'
    const commentingClosedDateField = fg.get('commentingClosedDate');
    if (!commentingClosedDateField) return;
    const closeDatePipe = this.datePipe.transform(fg.value.commentingClosedDate, DEFAULT_ISO_DATE_FORMAT);
    commentingClosedDateField.setValue(closeDatePipe);
    if ((user.isMinistry && !user.isForestClient) ||
        commentingOpenDateField.value == null) {
      commentingClosedDateField.disable();
    }

    fg.get('district')?.setValue(project?.district.id);
  }

  getErrorMessage(controlName: string, messageKey: string | null = null): string | null {
    const errors = this.fg.controls[controlName]?.errors;
    if (errors != null && messageKey !== null) {
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
