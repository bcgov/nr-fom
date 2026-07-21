import { CognitoService } from "@admin-core/services/cognito.service";
import { ModalService } from '@admin-core/services/modal.service';
import { StateService } from '@admin-core/services/state.service';
import { MAX_FILEUPLOAD_SIZE } from '@admin-core/utils/constants';
import { DatePipe } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
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
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  snackBar = inject(MatSnackBar);
  private projectSvc = inject(ProjectService);
  private formBuilder = inject(RxFormBuilder);
  private stateSvc = inject(StateService);
  private modalSvc = inject(ModalService);
  private submissionSvc = inject(SubmissionService);
  private cognitoService = inject(CognitoService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  public fg: RxFormGroup;
  public project: ProjectResponse;
  public spatialSubmission: SubmissionDetailResponse;
  public originalSubmissionRequest:  SubmissionRequest;
  public applicationFiles: File[] = [];
  public fileTypesParent: string[] = ['text/plain', 'application/json']
  public file: File = null;
  public geoTypeValues: string[] = [];
  public contentFile: string;
  public maxSpatialFileSize: number = MAX_FILEUPLOAD_SIZE.SPATIAL;
  public isSubmitting = false;
  readonly SpatialObjectCodeEnum = SpatialObjectCodeEnum;
  readonly projectPlanCodeEnum = ProjectPlanCodeEnum;
  private scrollToFragment: string = null;
  private snackBarRef: MatSnackBarRef<SimpleSnackBar> = null;
  private user: User;
  
  public findProject$ = this.projectSvc.projectControllerFindOne(this.route.snapshot.params.appId);

  get isLoading() {
    return this.stateSvc.loading;
  }

  constructor() {
    this.user = this.cognitoService.getUser();
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
    const routerFragment = ['/a', this.project.id]
    this.router.navigate(routerFragment);
  }

  ngOnInit() {
    this.geoTypeValues = Object.values(SpatialObjectCodeEnum);
    let submissionTypeCode = SubmissionTypeCodeEnum.Proposed; // default
    this.route.url.pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap(() => {
        return this.findProject$;
      })
    )
    .pipe(
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
      this.project = data.projectResponse;
      this.spatialSubmission = data.spatialSubmission;
      this.originalSubmissionRequest = <SubmissionRequest> {
        projectId: this.project.id,
        submissionTypeCode: submissionTypeCode,
        spatialObjectCode: SpatialObjectCodeEnum.CutBlock,
        jsonSpatialSubmission: Object
      }
      const form = new FomSubmissionForm(this.originalSubmissionRequest);
      this.fg = <RxFormGroup>this.formBuilder.formGroup(form);
      this.fg.get('projectId').setValue(this.originalSubmissionRequest.projectId);
      this.fg.get('submissionTypeCode').setValue(this.originalSubmissionRequest.submissionTypeCode);
      this.cdr.detectChanges();

      // stateSvc.loading flips back to false in the HTTP interceptor's finalize(),
      // which runs after this callback returns — defer so the View FOM button
      // spinner picks up the settled value instead of a stale "true".
      setTimeout(() => this.cdr.detectChanges());
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

  onFileEmit(newFile: File) {
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
          this.fg.get('jsonSpatialSubmission').setValue(this.originalSubmissionRequest.jsonSpatialSubmission);
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
    const submissionRequest = {...rest, ...this.fg.value}
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

  changeGeoType(e) {
    this.fg.get('spatialObjectCode').setValue(e.target.value);
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
    return this.project.workflowState.code === WorkflowStateEnum.Initial
      || this.project.workflowState.code === WorkflowStateEnum.CommentClosed ;
  }

  public canDeleteSpatialSubmission() {
    return this.user.isAuthorizedForClientId(this.project.forestClient.id) &&
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
            return this.findSpatialSubmission(this.project.id);
          })
        )
        .subscribe(data => this.spatialSubmission = data);
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