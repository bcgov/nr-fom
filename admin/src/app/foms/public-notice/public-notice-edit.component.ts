import { ModalService } from '@admin-core/services/modal.service';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ProjectResponse, PublicNoticeCreateRequest, PublicNoticeResponse,
  PublicNoticeService, PublicNoticeUpdateRequest, WorkflowStateEnum
} from '@api-client';
import { RxFormBuilder } from '@rxweb/reactive-form-validators';
import { User } from "@utility/security/user";
import { lastValueFrom, map, Subject, switchMap } from 'rxjs';
import { KeycloakService } from "../../../core/services/keycloak.service";
import { StateService } from '../../../core/services/state.service';
import { PublicNoticeForm } from './public-notice.form';

@Component({
  selector: 'app-public-notice-edit',
  templateUrl: './public-notice-edit.component.html',
  styleUrls: ['./public-notice-edit.component.scss']
})
export class PublicNoticeEditComponent implements OnInit, OnDestroy {
  user: User;
  project: ProjectResponse;
  projectId: number;
  isNewForm: boolean;
  publicNoticeResponse: PublicNoticeResponse;
  publicNoticeFormGroup: FormGroup;
  addressLimit: number = 500;
  businessHoursLimit: number = 100;
  editMode: boolean; // 'edit'/'view' mode.

  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formBuilder: RxFormBuilder,
    public stateSvc: StateService,
    private keycloakService: KeycloakService,
    private modalSvc: ModalService,
    private publicNoticeService: PublicNoticeService
  ) {
    this.user = this.keycloakService.getUser();
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
        let publicNoticeForm = new PublicNoticeForm(this.publicNoticeResponse);
        this.publicNoticeFormGroup = this.formBuilder.formGroup(publicNoticeForm);

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

      if (this.isAddNewNotice()) {
        // POST - Create Public Notice.
        await lastValueFrom(this.createNewPublicNotice());
      }
      else {
        await lastValueFrom(this.updatePublicNotice());
      }
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

  private createNewPublicNotice() {
    let createBody = this.publicNoticeFormGroup.value as PublicNoticeCreateRequest
    createBody.projectId = this.project.id;
    return this.publicNoticeService.publicNoticeControllerCreate(createBody);
  }

  private updatePublicNotice() {
    const updateBody = this.publicNoticeFormGroup.value as PublicNoticeUpdateRequest;
    updateBody.projectId = this.project.id;
    updateBody.revisionCount = this.publicNoticeResponse.revisionCount;
    return this.publicNoticeService.publicNoticeControllerUpdate(this.publicNoticeResponse.id, updateBody);
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next(true);
    this.ngUnsubscribe.complete();
  }
}
