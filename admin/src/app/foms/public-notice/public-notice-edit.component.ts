import { CognitoService } from "@admin-core/services/cognito.service";
import { ModalService } from '@admin-core/services/modal.service';
import { LoadingService } from '@admin-core/services/loading.service';
import { DEFAULT_ISO_DATE_FORMAT } from "@admin-core/utils/constants";
import { DatePipe } from "@angular/common";
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
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
export class PublicNoticeEditComponent {
  private router = inject(Router);
  private formBuilder = inject(RxFormBuilder);
  loadingSvc = inject(LoadingService);
  private cognitoService = inject(CognitoService);
  private modalSvc = inject(ModalService);
  private publicNoticeService = inject(PublicNoticeService);
  private datePipe = inject(DatePipe);

  // Route-bound inputs: appId param, projectDetail resolver data, and editMode from route `data`.
  readonly appId = input.required<string>();
  readonly projectDetail = input.required<ProjectResponse>();
  readonly editMode = input.required<boolean>(); // 'edit'/'view' mode, from route data

  // Populated from the authenticated Cognito session in the constructor.
  user!: User;
  project: ProjectResponse;
  readonly projectId = computed(() => Number(this.appId()));
  isNewForm: boolean;
  publicNoticeResponse: PublicNoticeResponse | null;
  publicNoticeFormGroup: IFormGroup<PublicNoticeForm>;
  addressLimit: number = 500;
  businessHoursLimit: number = 100;
  maxPostDate: Date;
  minPostDate: Date = DateTime.now().plus({days: 1}).toJSDate(); // 1 day in the future.

  /**
   * The notice to edit: the project's own notice when it already has one, otherwise the forest client's
   * most recent notice, which is used to prefill a new one.
   */
  private readonly publicNoticeResource = rxResource({
    params: () => this.projectDetail(),
    stream: ({ params }) => params.publicNoticeId
      ? this.publicNoticeService.publicNoticeControllerFindOne(params.publicNoticeId)
      : this.publicNoticeService.publicNoticeControllerFindLatestPublicNotice(params.forestClient.id),
  });

  /**
   * Flips once the @rxweb form group has been built from the fetched notice. The form group itself stays
   * a plain field — it is built once and never replaced — so this signal is what tells the template that
   * the form is ready to render.
   */
  readonly formReady = signal(false);

  constructor() {
    const user = this.cognitoService.getUser();
    if (user) {
      this.user = user;
    }

    effect(() => {
      if (!this.publicNoticeResource.hasValue()) {
        return;
      }
      const publicNotice = this.publicNoticeResource.value() ?? null;
      // Only the fetched notice re-triggers this; everything the initializer reads besides it is
      // route-constant for the lifetime of one activation.
      untracked(() => this.buildForm(publicNotice));
    });
  }

  /**
   * Builds the edit form from the fetched notice. Mirrors the pre-fetch ordering the form depends on:
   * `isNewForm` and the post-date bounds must be settled before `processBeforeFormGroupInitialized()`
   * adjusts the response, which must in turn happen before the form group is created from it.
   */
  private buildForm(publicNotice: PublicNoticeResponse | null) {
    const projectDetail = this.projectDetail();
    this.project = projectDetail;
    this.isNewForm = !projectDetail.publicNoticeId;
    this.publicNoticeResponse = publicNotice;
    this.maxPostDate = DateTime.fromISO(this.project.commentingOpenDate).toJSDate();
    this.processBeforeFormGroupInitialized()

    const publicNoticeForm = new PublicNoticeForm(this.publicNoticeResponse ?? undefined);
    this.publicNoticeFormGroup = this.formBuilder.formGroup(publicNoticeForm) as IFormGroup<PublicNoticeForm>;
    this.onSameAsReviewIndToggled();
    if (!this.editMode()) {
      this.publicNoticeFormGroup.disable();
    }
    this.formReady.set(true);
  }

  processBeforeFormGroupInitialized() {
    if (!this.editMode()) return;
    
    if (this.isNewForm) {
      // Don't inherit operation years from previous public notice from the forest client.
      // Cast to Partial so the (non-optional in the generated type) postDate can be deleted.
      if (this.publicNoticeResponse) {
        delete (this.publicNoticeResponse as Partial<PublicNoticeResponse>).postDate;
      }
    }
    else { // a case there was public notice saved for the project.
      // This is a tricky case. "bsDatepicker" when (minDate=maxDate) and when previous field date falls
      // outside of the date range, "bsDatepicker" has problem initializing it and even if you trying picking from UI.
      // So, specifically set it here for corner cases.
      const pnPostDate = this.publicNoticeResponse?.postDate;
      if (pnPostDate && this.publicNoticeResponse) {
        const startOfPnPostDate = DateTime.fromISO(pnPostDate).startOf('day');
        const startOfCommentingOpenDate = DateTime.fromISO(this.project.commentingOpenDate).startOf('day');
        const startOfMinPostDate = DateTime.fromJSDate(this.minPostDate).startOf('day');
        const startOfMaxPostDate = DateTime.fromJSDate(this.maxPostDate).startOf('day');
        if (startOfMinPostDate <= startOfCommentingOpenDate) {
          if ((startOfPnPostDate < startOfMinPostDate) || (startOfPnPostDate > startOfMaxPostDate)){
            // startOfMinPostDate is derived from a valid date, so toISODate() is non-null here.
            this.publicNoticeResponse.postDate = startOfMinPostDate.toISODate()!;
          }
        }
        else if (startOfMinPostDate > startOfCommentingOpenDate) {
          // Clear the post date; postDate is non-optional in the generated type, so cast to Partial.
          (this.publicNoticeResponse as Partial<PublicNoticeResponse>).postDate = undefined;
        }
      }
    }
  }

  get isLoading() {
    return this.loadingSvc.loading();
  }

  isAddNewNotice() {
    return this.editMode() && this.isNewForm;
  }

  onSameAsReviewIndToggled(): void {
    const sameAsReviewIndField = this.publicNoticeFormGroup.get('isReceiveCommentsSameAsReview');
    const receiveCommentsAddressField = this.publicNoticeFormGroup.get('receiveCommentsAddress');
    const receiveCommentsBusinessHoursField = this.publicNoticeFormGroup.get('receiveCommentsBusinessHours');

    if (!sameAsReviewIndField || !receiveCommentsAddressField || !receiveCommentsBusinessHoursField) {
      return;
    }

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
      `You are about to delete Online Public Notice <strong>#${this.publicNoticeResponse!.id}</strong>. Are you sure?`,
      'Delete Online Public Notice');

    dialogRef.afterClosed().subscribe(async (confirm) => {
      if (confirm) {
        await lastValueFrom(
          this.publicNoticeService.publicNoticeControllerRemove(this.publicNoticeResponse!.id)
        );
        this.router.navigate(['/a', this.projectId()]);
      }
    });
  }

  cancelChanges() {
    this.router.navigate(['/a', this.projectId()]);
  }

  async onSubmit() {
    if (this.editMode() && this.publicNoticeFormGroup.valid) {
      await lastValueFrom(this.submitPublicNotice());
      this.router.navigate(['/a', this.projectId()]);
    }
  }

  getErrorMessage(controlName: string, messageKey: string | null = null): string | null {
    const errors = this.publicNoticeFormGroup.get(controlName)?.errors;
    if (errors != null && messageKey !== null) {
      const { [messageKey]: messages } = errors;
      if (messages) return messages.message;
    }
    return null;
  }

  fieldTouchedOrDirty(controlName: string): boolean {
    const control = this.publicNoticeFormGroup.get(controlName);
    return !!(control?.touched || control?.dirty);
  }

  private submitPublicNotice() {
    let body: any;
    if (this.isAddNewNotice()) {
      body = this.publicNoticeFormGroup.value as Partial<PublicNoticeCreateRequest>;
    }
    else {
      body = this.publicNoticeFormGroup.value as Partial<PublicNoticeUpdateRequest>;
      body.revisionCount = this.publicNoticeResponse!.revisionCount;
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
      return this.publicNoticeService.publicNoticeControllerUpdate(this.publicNoticeResponse!.id, body);
    }
  }

  warnIfPostDateSelectionNotAvailable(postDatePicker: { toggle: () => void }) {
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

