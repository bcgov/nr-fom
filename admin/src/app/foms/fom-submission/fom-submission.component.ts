import { CognitoService } from "@admin-core/services/cognito.service";
import { ModalService } from '@admin-core/services/modal.service';
import { StateService } from '@admin-core/services/state.service';
import { MAX_FILEUPLOAD_SIZE } from '@admin-core/utils/constants';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectPlanCodeEnum, ProjectResponse, ProjectService, SpatialObjectCodeEnum, SubmissionDetailResponse, SubmissionRequest, SubmissionService, SubmissionTypeCodeEnum, WorkflowStateEnum } from '@api-client';
import { NgbDropdown, NgbDropdownMenu, NgbDropdownToggle } from '@ng-bootstrap/ng-bootstrap';
import { RxFormBuilder, RxFormGroup } from '@rxweb/reactive-form-validators';
import { User } from '@utility/security/user';
import { Observable, Subject } from 'rxjs';
import { map, switchMap, takeUntil } from 'rxjs/operators';
import { FomSubmissionForm } from './fom-submission.form';
import { SubmissionOverviewFaqComponent } from './submission-overview-faq.component';

import { UploadBoxComponent } from '@admin-core/components/file-upload-box/file-upload-box.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';


@Component({
    standalone: true,
    imports: [
        NgIf, 
        FormsModule, 
        ReactiveFormsModule, 
        NgFor, 
        SubmissionOverviewFaqComponent, 
        DatePipe, 
        UploadBoxComponent,
        NgbDropdown, 
        NgbDropdownToggle, 
        NgbDropdownMenu, 
    ],
    selector: 'app-fom-submission',
    templateUrl: './fom-submission.component.html',
    styleUrls: ['./fom-submission.component.scss'],
    providers: [DatePipe]
})
export class FomSubmissionComponent implements OnInit, AfterViewInit, OnDestroy {
  public fg: RxFormGroup;
  public project: ProjectResponse;
  public spatialSubmission: SubmissionDetailResponse;
  public originalSubmissionRequest:  SubmissionRequest;
  public applicationFiles: File[] = [];
  public fileTypesParent: string[] = ['text/plain', 'application/json']
  public files: any[] = [];
  public geoTypeValues: string[] = [];
  public contentFile: string;
  public maxSpatialFileSize: number = MAX_FILEUPLOAD_SIZE.SPATIAL;
  public isSubmitting = false;
  readonly SpatialObjectCodeEnum = SpatialObjectCodeEnum;
  readonly projectPlanCodeEnum = ProjectPlanCodeEnum;
  private scrollToFragment: string = null;
  private snackBarRef: MatSnackBarRef<SimpleSnackBar> = null;
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();
  private user: User;
  
  public findProject$ = this.projectSvc.projectControllerFindOne(this.route.snapshot.params.appId);

  get isLoading() {
    return this.stateSvc.loading;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public snackBar: MatSnackBar,
    private projectSvc: ProjectService,
    private formBuilder: RxFormBuilder,
    private stateSvc: StateService,
    private modalSvc: ModalService,
    private submissionSvc: SubmissionService,
    private cognitoService: CognitoService
  ) {
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
      takeUntil(this.ngUnsubscribe), 
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

    this.ngUnsubscribe.next(null);
    this.ngUnsubscribe.complete();
  }

  addNewFiles(newFiles: any[]) {
    this.files.push(newFiles);
  }

  getContentFileFromUpload(fileContent: any) {
    this.contentFile = fileContent;
    try {
      this.originalSubmissionRequest.jsonSpatialSubmission = JSON.parse(this.contentFile);
    }catch (e) {
      this.modalSvc.openErrorDialog('The file is not in a valid JSON format. Please fix your file and try again.');
    }
    this.fg.get('jsonSpatialSubmission').setValue(this.originalSubmissionRequest.jsonSpatialSubmission);
  }

  submit() {
    const {projectId, submissionTypeCode, ...rest} = this.originalSubmissionRequest;
    let submissionRequest = {...rest, ...this.fg.value}
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