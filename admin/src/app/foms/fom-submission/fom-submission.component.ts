import { CognitoService } from "@admin-core/services/cognito.service";
import { ModalService } from '@admin-core/services/modal.service';
import { LoadingService } from '@admin-core/services/loading.service';
import { MAX_FILEUPLOAD_SIZE } from '@admin-core/utils/constants';
import { DatePipe } from '@angular/common';
import { AfterViewInit, Component, DestroyRef, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { ProjectPlanCodeEnum, ProjectResponse, ProjectService, SpatialObjectCodeEnum, SubmissionDetailResponse, SubmissionRequest, SubmissionService, SubmissionTypeCodeEnum, WorkflowStateEnum } from '@api-client';
import { NgbDropdown, NgbDropdownMenu, NgbDropdownToggle } from '@ng-bootstrap/ng-bootstrap';
import { RxFormBuilder, RxFormGroup } from '@rxweb/reactive-form-validators';
import { User } from '@utility/security/user';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { FomSubmissionForm } from './fom-submission.form';
import { SubmissionOverviewFaqComponent } from './submission-overview-faq.component';

import { UploadBoxComponent } from '@admin-core/components/file-upload-box/file-upload-box.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';


@Component({
    imports: [
    FormsModule,
    ReactiveFormsModule,
    SubmissionOverviewFaqComponent,
    DatePipe,
    UploadBoxComponent,
    NgbDropdown,
    NgbDropdownToggle,
    NgbDropdownMenu
],
    selector: 'app-fom-submission',
    templateUrl: './fom-submission.component.html',
    styleUrl: './fom-submission.component.scss',
    providers: [DatePipe]
})
export class FomSubmissionComponent implements OnInit, AfterViewInit, OnDestroy {
  private router = inject(Router);
  snackBar = inject(MatSnackBar);
  private projectSvc = inject(ProjectService);
  private formBuilder = inject(RxFormBuilder);
  private loadingSvc = inject(LoadingService);
  private modalSvc = inject(ModalService);
  private submissionSvc = inject(SubmissionService);
  private cognitoService = inject(CognitoService);
  private destroyRef = inject(DestroyRef);

  // Signal so the template's `@if (fg())` gate is reactive
  public readonly fg = signal<RxFormGroup | undefined>(undefined);
  public readonly project = signal<ProjectResponse | undefined>(undefined);
  public readonly spatialSubmission = signal<SubmissionDetailResponse | undefined>(undefined);
  public originalSubmissionRequest:  SubmissionRequest;
  public applicationFiles: File[] = [];
  public fileTypesParent: string[] = ['text/plain', 'application/json']
  public file: File | null = null;
  public geoTypeValues: string[] = [];
  public contentFile: string;
  public maxSpatialFileSize: number = MAX_FILEUPLOAD_SIZE.SPATIAL;
  public isSubmitting = false;
  readonly SpatialObjectCodeEnum = SpatialObjectCodeEnum;
  readonly projectPlanCodeEnum = ProjectPlanCodeEnum;
  private scrollToFragment: string | null = null;
  private snackBarRef: MatSnackBarRef<SimpleSnackBar> | null = null;
  // Populated from the authenticated Cognito session in the constructor.
  private user!: User;

  readonly appId = input.required<string>();

  get isLoading() {
    return this.loadingSvc.loading();
  }

  constructor() {
    const user = this.cognitoService.getUser();
    if (user) {
      this.user = user;
    }
  }

  // check for unsaved changes before navigating away from current route (ie, this page)
  public canDeactivate(): Observable<boolean> | boolean {
    const fg = this.fg();
    if (!fg) {
      return true;
    }

    // allow synchronous navigation if everything is OK
    if (!fg.dirty && !fg.isModified) {
      return true;
    }

    return false;
  }

  public cancelChanges() {
    // can't call location back() - fails when cancel is cancelled due to dirty form or unsaved documents multiple times
    const routerFragment = ['/a', this.project()?.id]
    this.router.navigate(routerFragment);
  }

  ngOnInit() {
    this.geoTypeValues = Object.values(SpatialObjectCodeEnum);
    let submissionTypeCode = SubmissionTypeCodeEnum.Proposed; // default
    const findProject$ = this.projectSvc.projectControllerFindOne(Number(this.appId()));
    findProject$.pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap((projectResponse: ProjectResponse) => {
        if (projectResponse.workflowState.code === WorkflowStateEnum.CommentClosed) {
          submissionTypeCode = SubmissionTypeCodeEnum.Final;
        }
        return this.findSpatialSubmission(projectResponse.id).pipe(
            map(s => {
              return {projectResponse, spatialSubmission: s}
            })
          );
      })
    )
    .subscribe((data) => {
      this.project.set(data.projectResponse);
      this.spatialSubmission.set(data.spatialSubmission);
      this.originalSubmissionRequest = <SubmissionRequest> {
        projectId: data.projectResponse.id,
        submissionTypeCode: submissionTypeCode,
        spatialObjectCode: SpatialObjectCodeEnum.CutBlock,
        jsonSpatialSubmission: Object
      }
      const form = new FomSubmissionForm(this.originalSubmissionRequest);
      const fg = <RxFormGroup>this.formBuilder.formGroup(form);
      fg.get('projectId')?.setValue(this.originalSubmissionRequest.projectId);
      fg.get('submissionTypeCode')?.setValue(this.originalSubmissionRequest.submissionTypeCode);
      this.fg.set(fg);
    });
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

  onFileEmit(newFile: File | null) {
    this.file = newFile;
    if (!this.file) {
      this.modalSvc.openErrorDialog('Please select a JSON file to continue.');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        if (reader.readyState !== FileReader.DONE) {
          return;
        }

        try {
          const content = e.target?.result;
          if (typeof content !== 'string') {
            throw new Error('File content is not text.');
          }

          this.originalSubmissionRequest.jsonSpatialSubmission = JSON.parse(content);
          this.fg()?.get('jsonSpatialSubmission')?.setValue(this.originalSubmissionRequest.jsonSpatialSubmission);
        } catch (_parseError) {
          this.modalSvc.openErrorDialog('The selected file is not valid JSON. Please fix the file and try again.');
        }
      };

      reader.onerror = () => {
        this.modalSvc.openErrorDialog('Could not read the selected file. Please try again.');
      };

      reader.readAsText(this.file);
    } catch (_readSetupError) {
      this.modalSvc.openErrorDialog('Could not process the selected file. Please try again.');
    }
  }

  submit() {
    const {projectId, submissionTypeCode, ...rest} = this.originalSubmissionRequest;
    const submissionRequest = {...rest, ...this.fg()!.value}
    this.isSubmitting = true;
    this.submissionSvc.submissionControllerProcessSpatialSubmission(submissionRequest as SubmissionRequest)
        .subscribe({
          next: () => this.onSuccess(this.originalSubmissionRequest.projectId),
          error: () => this.isSubmitting = false
        });
  }

  onSuccess(id: number) {
    this.router.navigate([`a/${id}`])
    this.isSubmitting = false;
  }

  changeGeoType(e: Event) {
    this.fg()?.get('spatialObjectCode')?.setValue((e.target as HTMLSelectElement).value);
  }

  getGeoSpatialTypeDescription(type: string){
    if( type === SpatialObjectCodeEnum.CutBlock ){
      return 'Cut block'
    }else if( type === SpatialObjectCodeEnum.RoadSection ) {
      return 'Road section'
    }
    return 'Wildlife/tree retention area'
  }

  public isSubmissionAllowed(){
    return this.project()?.workflowState.code === WorkflowStateEnum.Initial
      || this.project()?.workflowState.code === WorkflowStateEnum.CommentClosed ;
  }

  public canDeleteSpatialSubmission() {
    return this.user.isAuthorizedForClientId(this.project()!.forestClient.id) &&
      this.isSubmissionAllowed();
  }

  public onDeleteSpatialSubmission(submissionId: number, spatialObjectCode: SpatialObjectCodeEnum) {
    const dialogRef = this.modalSvc.openConfirmationDialog(
      `You are about to delete this submission. Are you sure?`, 'Delete Submission');
    dialogRef.afterClosed().subscribe((confirm) => {
      if (confirm) {
        this.deleteSpatialSubmission(submissionId, spatialObjectCode)
        .pipe(
          switchMap(() => {
            return this.findSpatialSubmission(this.project()!.id);
          })
        )
        .subscribe(data => this.spatialSubmission.set(data));
      }
    });
  }

  private findSpatialSubmission(projectId: number) {
    return this.submissionSvc.submissionControllerFindSubmissionDetailForCurrentSubmissionType(
      projectId
    );
  }

  private deleteSpatialSubmission(submissionId: number, spatialObjectCode: SpatialObjectCodeEnum) {
    return this.submissionSvc.submissionControllerRemoveSpatialSubmissionByType(
      submissionId,
      spatialObjectCode
    );
  }
}