import { CognitoService } from "@admin-core/services/cognito.service";
import { ModalService } from '@admin-core/services/modal.service';
import { StateService } from '@admin-core/services/state.service';
import { DEFAULT_ISO_DATE_FORMAT } from "@admin-core/utils/constants";
import { DatePipe } from "@angular/common";
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ProjectResponse, PublicNoticeCreateRequest, PublicNoticeResponse,
  PublicNoticeService, PublicNoticeUpdateRequest, WorkflowStateEnum
} from '@api-client';
import { IFormGroup, RxFormBuilder } from '@rxweb/reactive-form-validators';
import { User } from "@utility/security/user";
import { DateTime } from "luxon";
import { BsDatepickerModule } from "ngx-bootstrap/datepicker";
import { lastValueFrom } from 'rxjs';
import { PublicNoticeForm } from './public-notice.form';

@Component({
    imports: [
    FormsModule,
    ReactiveFormsModule,
    BsDatepickerModule
],
    selector: 'app-public-notice-edit',
    templateUrl: './public-notice-edit.component.html',
    styleUrl: './public-notice-edit.component.scss',
    providers: [DatePipe]
})
export class PublicNoticeEditComponent implements OnInit {
  private router = inject(Router);
  private formBuilder = inject(RxFormBuilder);
  stateSvc = inject(StateService);
  private cognitoService = inject(CognitoService);
  private modalSvc = inject(ModalService);
  private publicNoticeService = inject(PublicNoticeService);
  private datePipe = inject(DatePipe);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  // Route-bound inputs: appId param, projectDetail resolver data, and editMode from route `data`.
  readonly appId = input.required<string>();
  readonly projectDetail = input.required<ProjectResponse>();
  readonly editMode = input.required<boolean>(); // 'edit'/'view' mode, from route data

  user: User;
  project: ProjectResponse;
  projectId: number;
  isNewForm: boolean;
  publicNoticeResponse: PublicNoticeResponse;
  publicNoticeFormGroup: IFormGroup<PublicNoticeForm>;
  addressLimit: number = 500;
  businessHoursLimit: number = 100;
  maxPostDate: Date;
  minPostDate: Date = DateTime.now().plus({days: 1}).toJSDate(); // 1 day in the future.

  constructor() {
    this.user = this.cognitoService.getUser();
  }

  ngOnInit() {
    this.projectId = Number(this.appId());

    // projectDetail comes from the route resolver (bound as an input); fetch the matching
    // public notice — the latest for the forest client when the project has none yet.
    const projectDetail = this.projectDetail();
    const publicNoticeId = projectDetail.publicNoticeId;
    this.isNewForm = !publicNoticeId;
    const publicNotice$ = publicNoticeId
      ? this.publicNoticeService.publicNoticeControllerFindOne(publicNoticeId)
      : this.publicNoticeService.publicNoticeControllerFindLatestPublicNotice(projectDetail.forestClient.id);

    publicNotice$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((pn) => {
        this.project = projectDetail;
        this.publicNoticeResponse = pn;
        this.maxPostDate = DateTime.fromISO(this.project.commentingOpenDate).toJSDate();
        this.processBeforeFormGroupInitialized()

        const publicNoticeForm = new PublicNoticeForm(this.publicNoticeResponse);
        this.publicNoticeFormGroup = this.formBuilder.formGroup(publicNoticeForm) as IFormGroup<PublicNoticeForm>;
        this.onSameAsReviewIndToggled();
        if (!this.editMode()) {
          this.publicNoticeFormGroup.disable();
        }
        this.cdr.detectChanges();
      });
  }

  processBeforeFormGroupInitialized() {
    if (!this.editMode()) return;
    
    if (this.isNewForm) {
      // Don't inherit operation years from previous public notice from the forest client.
      delete this.publicNoticeResponse?.postDate;
    }
    else { // a case there was public notice saved for the project.
      // This is a tricky case. "bsDatepicker" when (minDate=maxDate) and when previous field date falls
      // outside of the date range, "bsDatepicker" has problem initializing it and even if you trying picking from UI.
      // So, specifically set it here for corner cases.
      const pnPostDate = this.publicNoticeResponse?.postDate;
      const startOfPnPostDate = DateTime.fromISO(pnPostDate).startOf('day');
      const startOfCommentingOpenDate = DateTime.fromISO(this.project.commentingOpenDate).startOf('day');
      const startOfMinPostDate = DateTime.fromJSDate(this.minPostDate).startOf('day');
      const startOfMaxPostDate = DateTime.fromJSDate(this.maxPostDate).startOf('day');
      if (pnPostDate && startOfMinPostDate <= startOfCommentingOpenDate) {
        if ((startOfPnPostDate < startOfMinPostDate) || (startOfPnPostDate > startOfMaxPostDate)){
          this.publicNoticeResponse.postDate = startOfMinPostDate.toISODate();
        }
      }
      else if (pnPostDate && (startOfMinPostDate > startOfCommentingOpenDate)) {
        this.publicNoticeResponse.postDate = null;
      }
    }
  }

  get isLoading() {
    return this.stateSvc.loading();
  }

  isAddNewNotice() {
    return this.editMode() && this.isNewForm;
  }

  onSameAsReviewIndToggled(): void {
    const sameAsReviewIndField = this.publicNoticeFormGroup.get('isReceiveCommentsSameAsReview');
    const receiveCommentsAddressField = this.publicNoticeFormGroup.get('receiveCommentsAddress');
    const receiveCommentsBusinessHoursField = this.publicNoticeFormGroup.get('receiveCommentsBusinessHours');

    if (sameAsReviewIndField.value) {
      receiveCommentsAddressField.disable();
      receiveCommentsAddressField.setValue(null);

      receiveCommentsBusinessHoursField.disable();
      receiveCommentsBusinessHoursField.setValue(null);
    }
    else {
      receiveCommentsAddressField.enable();
      receiveCommentsBusinessHoursField.enable();
    }
  }

  canDelete() {
    if (this.isAddNewNotice()) {
      // Case of new Public Notice
      return false;
    }
    const workflowStateCode = this.project?.workflowState.code;
    if (WorkflowStateEnum.Initial === workflowStateCode) {
      return this.user.isForestClient && this.user.isAuthorizedForClientId(this.project.forestClient.id);
    }
    return false;
  }

  async deletePublicNotice() {
    const dialogRef = this.modalSvc.openConfirmationDialog(
      `You are about to delete Online Public Notice <strong>#${this.publicNoticeResponse.id}</strong>. Are you sure?`,
      'Delete Online Public Notice');

    dialogRef.afterClosed().subscribe(async (confirm) => {
      if (confirm) {
        await lastValueFrom(
          this.publicNoticeService.publicNoticeControllerRemove(this.publicNoticeResponse.id)
        );
        this.router.navigate(['/a', this.projectId]);
      }
    });
  }

  cancelChanges() {
    this.router.navigate(['/a', this.projectId]);
  }

  async onSubmit() {
    if (this.editMode() && this.publicNoticeFormGroup.valid) {
      await lastValueFrom(this.submitPublicNotice());
      this.router.navigate(['/a', this.projectId]);
    }
  }

  getErrorMessage(controlName: string, messageKey: string = null): string {
    const errors = this.publicNoticeFormGroup.controls[controlName]?.errors;
    if (errors !== null) {
      const { [messageKey]: messages } = errors;
      if (messages) return messages.message;
    }
    return null;
  }

  fieldTouchedOrDirty(controlName: string): boolean {
    const control = this.publicNoticeFormGroup.controls[controlName];
    return control?.touched || control?.dirty;
  }

  private submitPublicNotice() {
    let body: any;
    if (this.isAddNewNotice()) {
      body = this.publicNoticeFormGroup.value as Partial<PublicNoticeCreateRequest>;
    }
    else {
      body = this.publicNoticeFormGroup.value as Partial<PublicNoticeUpdateRequest>;
      body.revisionCount = this.publicNoticeResponse.revisionCount;
    }

    body.projectId = this.project.id;

    if (body.pnPostDate) {
      body.postDate = this.datePipe.transform(body.pnPostDate, DEFAULT_ISO_DATE_FORMAT);
    }
    else {
      body.postDate = null;
    }
    if (this.isAddNewNotice()) {
      return this.publicNoticeService.publicNoticeControllerCreate(body);
    }
    else {
      return this.publicNoticeService.publicNoticeControllerUpdate(this.publicNoticeResponse.id, body);
    }
  }

  warnIfPostDateSelectionNotAvailable(postDatePicker) {
    const startOfMinPostDate = DateTime.fromJSDate(this.minPostDate).startOf('day');
    const startOfCommentingOpenDate = DateTime.fromISO(this.project.commentingOpenDate).startOf('day');
    if (!this.project.commentingOpenDate || startOfMinPostDate > startOfCommentingOpenDate)
    {
      postDatePicker.toggle(); // bsDatepicker seems to have strange behaviour. hide() won't work, use toggle() instead.
      this.modalSvc.openWarningDialog(`Commenting Start Date must be entered first and at least one day in the future before 
        Notice Publishing Date is available for selection.`);
    }
  }
}

