import { CognitoService } from "@admin-core/services/cognito.service";
import { ModalService } from '@admin-core/services/modal.service';
import { StateService } from '@admin-core/services/state.service';
import { DatePipe, NgClass, NgIf } from "@angular/common";
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
    ProjectResponse, PublicNoticeCreateRequest, PublicNoticeResponse,
    PublicNoticeService, PublicNoticeUpdateRequest, WorkflowStateEnum
} from '@api-client';
import { IFormGroup, RxFormBuilder } from '@rxweb/reactive-form-validators';
import { User } from "@utility/security/user";
import { BsDatepickerConfig, BsDatepickerModule } from "ngx-bootstrap/datepicker";
import { Subject, lastValueFrom } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { PublicNoticeForm } from './public-notice.form';
import moment = require('moment');

@Component({
    standalone: true,
    imports: [
        NgIf, 
        FormsModule, 
        ReactiveFormsModule, 
        NgClass, 
        BsDatepickerModule
    ],
    selector: 'app-public-notice-edit',
    templateUrl: './public-notice-edit.component.html',
    styleUrls: ['./public-notice-edit.component.scss'],
    providers: [DatePipe]
})
export class PublicNoticeEditComponent implements OnInit, OnDestroy {
  user: User;
  project: ProjectResponse;
  projectId: number;
  isNewForm: boolean;
  publicNoticeResponse: PublicNoticeResponse;
  publicNoticeFormGroup: IFormGroup<PublicNoticeForm>;
  addressLimit: number = 500;
  businessHoursLimit: number = 100;
  editMode: boolean; // 'edit'/'view' mode.
  maxPostDate: Date;
  minPostDate: Date = moment().add(1, 'days').toDate();

  // bsDatepicker config object
  readonly opYearBsConfig = {
      dateInputFormat: 'YYYY', 
      minMode: 'year', 
      minDate: moment().toDate(), 
      maxDate: moment().add(7, 'years').toDate(), // current + 7 years
      containerClass: 'theme-dark-blue'
  } as Partial<BsDatepickerConfig>

  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formBuilder: RxFormBuilder,
    public stateSvc: StateService,
    private cognitoService: CognitoService,
    private modalSvc: ModalService,
    private publicNoticeService: PublicNoticeService,
    private datePipe: DatePipe
  ) {
    this.user = this.cognitoService.getUser();
  }

  ngOnInit() {
    this.projectId = this.route.snapshot.params.appId;
    this.editMode = this.route.snapshot.url.filter(
      (seg)=> seg.path.includes('edit')
    ).length != 0;

    this.route.data
      .pipe(
        switchMap((resolverData) => {
          const publicNoticeId = resolverData['projectDetail'].publicNoticeId;
          this.isNewForm = !publicNoticeId;
          if (!publicNoticeId) {
            return this.publicNoticeService
              .publicNoticeControllerFindLatestPublicNotice(resolverData['projectDetail'].forestClient.id)
              .pipe(
                map(pn => {
                  return {data: resolverData, publicNotice: pn}
                })
              );
          }
          else {
            return this.publicNoticeService
              .publicNoticeControllerFindOne(publicNoticeId)
              .pipe(
                map(pn => {
                  return {data: resolverData, publicNotice: pn}
                })
              );
          }
        })
      )
      .subscribe((result) => {
        this.project = result.data.projectDetail;
        this.publicNoticeResponse = result.publicNotice;
        if (this.isNewForm) {
            // Don't inherit operation years from previous public notice from the forest client.
            delete this.publicNoticeResponse?.postDate;
        }
        let publicNoticeForm = new PublicNoticeForm(this.publicNoticeResponse);
        this.maxPostDate = moment(this.project.commentingOpenDate).toDate();
        this.publicNoticeFormGroup = this.formBuilder.formGroup(publicNoticeForm) as IFormGroup<PublicNoticeForm>;
        this.onSameAsReviewIndToggled();
        if (!this.editMode) {
          this.publicNoticeFormGroup.disable();
        }
      }
    );
  }

  get isLoading() {
    return this.stateSvc.loading;
  }

  isAddNewNotice() {
    return this.editMode && this.isNewForm;
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
    if (this.editMode && this.publicNoticeFormGroup.valid) {
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
      body.postDate = this.datePipe.transform(body.pnPostDate,'yyyy-MM-dd');
    }
    if (this.isAddNewNotice()) {
      return this.publicNoticeService.publicNoticeControllerCreate(body);
    }
    else {
      return this.publicNoticeService.publicNoticeControllerUpdate(this.publicNoticeResponse.id, body);
    }
  }

  isPostDateSelectionAvailable(postDatePicker) {
    if (!this.project.commentingOpenDate) {
        postDatePicker.toggle(); // bsDatepicker seems to have strange behaviour. hide() won't work, use toggle() instead.
        this.modalSvc.openWarningDialog(`Commenting Start Date must be entered first before 
        Public Notice Publishing Date is available for selection.`);
    }
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next(true);
    this.ngUnsubscribe.complete();
  }
}

