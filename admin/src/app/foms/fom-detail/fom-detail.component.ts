import { AttachmentResolverSvc } from "@admin-core/services/AttachmentResolverSvc";
import { CognitoService } from "@admin-core/services/cognito.service";
import { ModalService } from '@admin-core/services/modal.service';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AttachmentResponse, ProjectMetricsResponse, ProjectPlanCodeEnum, ProjectResponse, ProjectService, ProjectWorkflowStateChangeRequest, SpatialFeaturePublicResponse, WorkflowStateEnum } from "@api-client";
import { NgbModal, NgbModalRef, NgbModule, NgbNav } from '@ng-bootstrap/ng-bootstrap';
import { User } from "@utility/security/user";
import { FeatureSelectService } from '@utility/services/featureSelect.service';
import { DateTime } from "luxon";
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EnddateChangeModalComponent } from './enddate-change-modal/enddate-change-modal.component';

import { NewlinesPipe } from "@admin-core/pipes/newlines.pipe";
import { DatePipe, NgClass, NgFor, NgIf } from "@angular/common";
import { DetailsMapComponent } from "../details-map/details-map.component";
import { ShapeInfoComponent } from "../shape-info/shape-info.component";

@Component({
    standalone: true,
    imports: [
        NgIf, 
        RouterLink, 
        NgbNav,
        NgbModule, 
        NgFor, 
        DetailsMapComponent, 
        ShapeInfoComponent,
        NgClass,
        DatePipe, 
        NewlinesPipe
    ],
    selector: 'app-application-detail',
    templateUrl: './fom-detail.component.html',
    styleUrls: ['./fom-detail.component.scss']
})
export class FomDetailComponent implements OnInit, OnDestroy {
  readonly projectPlanCodeEnum = ProjectPlanCodeEnum;
  @ViewChild('scrollContainer')
  public scrollContainer: ElementRef;
  
  public changeEndDateModal : NgbModalRef = null;
  public isPublishing = false;
  public isDeleting = false;
  public isFinalizing = false;
  public isRefreshing = false;
  public isSettingCommentClassification = false;
  public application: ProjectResponse = null;
  public project: ProjectResponse = null;
  public spatialDetail: SpatialFeaturePublicResponse[];
  public projectMetrics: ProjectMetricsResponse;
  public isProjectActive = false;
  public attachments: AttachmentResponse[] = [];
  public user: User;
  public daysRemaining: number = null;
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();
  private workflowStateChangeRequest: ProjectWorkflowStateChangeRequest = <ProjectWorkflowStateChangeRequest>{};
  private now = new Date();
  private today = new Date(this.now.getFullYear(), this.now.getMonth(), this.now.getDate());
  private projectUpdateTriggered$ = new Subject(); // To notify when project update happen.

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private modalSvc: ModalService,
    public projectService: ProjectService, // also used in template
    public attachmentResolverSvc: AttachmentResolverSvc,
    private cognitoService: CognitoService,
    private ngbModalService: NgbModal,
    private fss: FeatureSelectService
  ) {
    this.user = this.cognitoService.getUser();
    this.router.routeReuseStrategy.shouldReuseRoute = () => false;
  }

  ngOnInit() {
    // get data from route resolver
    this.route.data
        .pipe(takeUntil(this.ngUnsubscribe))
        .subscribe((data: { projectDetail: ProjectResponse, 
                            spatialDetail: Array<SpatialFeaturePublicResponse>, 
                            projectMetrics: ProjectMetricsResponse }) => {
      if (data.projectDetail) {
        this.initProjectDetail(data.projectDetail);
      } else {
        alert("Uh-oh, couldn't load fom");
        // application not found --> navigate back to search
        this.router.navigate(['/search']);
      }

      this.spatialDetail = data.spatialDetail;
      this.projectMetrics = data.projectMetrics;
      this.attachmentResolverSvc.getAttachments(this.project.id)
        .then( (result) => {
          this.attachments = result;
          //Sorting by Public Notice and Supporting Document
          this.attachments.sort((a,b) => (a.attachmentType.code < b.attachmentType.code? -1 : 1));
        }).catch((error) => {
        console.error(error);
      });
    });

    // rxjs project update trigger initialization
    if (this.project.id) { // subscribe only when first project init successfully.
      this.projectUpdateTriggered$.pipe(takeUntil(this.ngUnsubscribe)).subscribe(() => {
        this.projectService.projectControllerFindOne(this.project.id).subscribe((data) => {
          this.initProjectDetail(data);
        });
      });
    }

    this.subscribeToFeatureSelectChange();
  }

  public deleteAttachment(id: number) {
    const dialogRef = this.modalSvc.openConfirmationDialog(`You are about to delete this attachment. Are you sure?`, 'Delete Attachment');
    dialogRef.afterClosed().subscribe((confirm) => {
      if (confirm) {
        let result = this.attachmentResolverSvc.attachmentControllerRemove(id);
        result.then( () => {
          return this.onSuccess();
        }).catch( (error) => {
          console.error(error);
        })
      }
    })
  }

  onSuccess() {
    this.router.navigate([`a/${this.project.id}`])
      .then( () => {
        window.location.reload();
      })
  }

  deleteFOM() {
    const dialogRef = this.modalSvc.openConfirmationDialog(`You are about to withdraw FOM ${this.project.id} - ${this.project.name}. Are you sure?`, 'Withdraw FOM');
    dialogRef.afterClosed().subscribe((confirm) => {
      if (confirm) {
        this.isDeleting = true;
        this.projectService.projectControllerRemove(this.project.id)
        .subscribe(
          ()=> {
            this.isDeleting = false;
            this.router.navigate(['/search']); // Delete successfully, back to search.
          },
          (error) => {
            this.isDeleting = false;
            console.error(error);
          }
        );
      }
    })
  }

  finalizeFOM() {
    const dialogRef = this.modalSvc.openConfirmationDialog(`Finalizing your FOM will send a notification to district staff, and lock the FOM, so you will not be able to make any changes. Do you want to proceed?`, 'Finalize FOM');
    dialogRef.afterClosed().subscribe((confirm) => {
      if (confirm) {
        this.isFinalizing = true;
        this.projectService.projectControllerStateChange(
            this.project.id,
            {
              workflowStateCode: WorkflowStateEnum.Finalized,
              revisionCount: this.project.revisionCount
            }
        )
        .subscribe(
          (_result)=> {
            this.isFinalizing = false;
            this.onSuccess();
          },
          (error) => {
            this.isFinalizing = false;
            console.error(error);
          }
        );
      }
    })
  }

  public async publishFOM(){
    const dialogRef = this.modalSvc.openConfirmationDialog(`Publishing your FOM will make it viewable to the public once commenting opens, and you will not be able to make any edits. Do you want to proceed?`, 'Publish FOM');
    dialogRef.afterClosed().subscribe(async (confirm) => {
      if (confirm) {
        const ready = this.validatePublishReady();
        if (ready) {
          this.workflowStateChangeRequest.workflowStateCode = WorkflowStateEnum.Published;
          this.workflowStateChangeRequest.revisionCount = this.project.revisionCount;

          this.isPublishing = true;
          try {
            await this.projectService.projectControllerStateChange(this.project.id, this.workflowStateChangeRequest).toPromise();
          } finally {
            this.isPublishing = false;
          }
          this.onSuccess()
        }
      }
    })
  }

  public goToPublicNotice() {
    if (this.canEditPublicNotice()) {
      this.router.navigate([`publicNotice/${this.project.id}/edit`])
    }
    else {
      this.router.navigate([`publicNotice/${this.project.id}`])
    }
  }

  public async setCommentClassification() {
    this.isSettingCommentClassification = true;
    try {
      await this.projectService.projectControllerCommentClassificationMandatoryChange(
        this.project.id, 
        {
          commentClassificationMandatory: !this.project.commentClassificationMandatory,
          revisionCount: this.project.revisionCount
        })
      .toPromise();

      // in this case trigger 'this.project' update locally instead of using // this.onSuccess(); which refresh whole page.
      this.projectUpdateTriggered$.next(null);
    } 
    catch(error) {
      console.error(error);
    } finally {
      this.isSettingCommentClassification = false;
    }
  }

  /**
    INITIAL: holder can withdraw.
    PUBLISH/COMMENT_OPEN: no actions.
    COMMENT_CLOSED/FINALIZED/EXPIRED: gov
  */
  public canWithdraw() {
    const workflowStateCode = this.project.workflowState.code;
    if (WorkflowStateEnum.Initial === workflowStateCode) {
      return this.user.isAuthorizedForClientId(this.project.forestClient.id);
    }
    else if (!this.user.isMinistry) {
      return false;
    }

    return [WorkflowStateEnum.CommentClosed, WorkflowStateEnum.Finalized, WorkflowStateEnum.Expired]
            .includes(workflowStateCode as WorkflowStateEnum);
  }

  public canFinalize() {
    return this.user.isAuthorizedForClientId(this.project.forestClient.id)
    && this.project.workflowState.code === WorkflowStateEnum.CommentClosed;
  }

  public canAccessComments(): boolean {
    const userCanView = this.user.isMinistry || this.user.isAuthorizedForClientId(this.project.forestClient.id);
    return userCanView && (this.project.workflowState.code !== WorkflowStateEnum.Initial
                        && this.project.workflowState.code !== WorkflowStateEnum.Published);
  }

  public canChangeEndDate(): boolean {
    return this.user.isMinistry && 
        (this.project.workflowState.code == WorkflowStateEnum.Initial
            || this.project.workflowState.code == WorkflowStateEnum.CommentOpen
        ) && !!this.project.commentingOpenDate;
  }

  public canEditFOM(): boolean {
    const userCanEdit = this.user.isAuthorizedForClientId(this.project.forestClient.id);
    return userCanEdit && (this.project.workflowState.code !== WorkflowStateEnum.Published
      && this.project.workflowState.code !== WorkflowStateEnum.Finalized
      && this.project.workflowState.code !== WorkflowStateEnum.Expired);
  }

  public canEditPublicNotice(): boolean {
    const userCanEdit = this.user.isAuthorizedForClientId(this.project.forestClient.id);
    return userCanEdit && this.project.workflowState.code === WorkflowStateEnum.Initial;
  }

  public canViewPublicNotice(): boolean {
    return this.user.isAuthorizedForClientId(this.project.forestClient.id)
            || this.user.isMinistry;
  }

  public canViewSubmission(): boolean {
    const userCanView = this.user.isAuthorizedForClientId(this.project.forestClient.id);
    return userCanView && (this.project.workflowState.code === WorkflowStateEnum.Initial
      || this.project.workflowState.code === WorkflowStateEnum.CommentClosed);
  }

  public canViewPublishing(): boolean {
    return this.user.isAuthorizedForClientId(this.project.forestClient.id)
      && this.project.workflowState.code === WorkflowStateEnum.Initial;
  }

  public canAccessInteractions(): boolean {
    return this.canAccessComments(); // same as comments for access/viewing.
  }

  public isDeleteAttachmentAllowed(attachment: AttachmentResponse) {
    return this.attachmentResolverSvc.isDeleteAttachmentAllowed(attachment.attachmentType.code, this.project.workflowState.code);
  }

  public canSetCommentClassification() {
    return this.user.isMinistry && 
          (this.project.workflowState.code == WorkflowStateEnum.CommentOpen
          || this.project.workflowState.code == WorkflowStateEnum.CommentClosed);
  }

  public openChangeEndDateModal() {
        // open modal
        this.changeEndDateModal = this.ngbModalService.open(EnddateChangeModalComponent, {
          backdrop: 'static',
          size: 'modal-sm', //or sm
          windowClass: 'enddate-change-modal' // Important! See endate-change-modal.component.scss for explanation.
        });
        
        let modalInstance = this.changeEndDateModal.componentInstance as EnddateChangeModalComponent;
        modalInstance.projectId = this.project.id;
        modalInstance.currentCommentingClosedDate = this.project.commentingClosedDate;
        modalInstance.changeRequest.revisionCount = this.project.revisionCount;
        
        this.changeEndDateModal.result.then(
          (result) => {
            // check result
            if (result.projectUpdated) {
              this.projectUpdateTriggered$.next(null);
            }
            this.changeEndDateModal = null;
          },
          () => {
            this.changeEndDateModal = null;
          }
        );
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next(null);
    this.ngUnsubscribe.complete();
  }

  private initProjectDetail(project: ProjectResponse) {
    this.project = project;
    if (this.project.workflowState['code'] === 'INITIAL') {
      this.isProjectActive = true;
    }
    if (this.project.commentClassificationMandatory == undefined) {
      this.project.commentClassificationMandatory = true;
    }
    this.calculateDaysRemaining();
  }

  private calculateDaysRemaining(){
    this.daysRemaining = (this.project.workflowState.code === WorkflowStateEnum.Initial) ?
    DateTime.fromISO(this.project.commentingClosedDate).diff(DateTime.fromISO(this.project.commentingOpenDate), 'days').as('days') :
    DateTime.fromISO(this.project.commentingClosedDate).diff(DateTime.fromJSDate(this.today), 'days').as('days');

    if(this.daysRemaining < 0){
      this.daysRemaining = 0;
    }
  }

  private validatePublishReady() {
    let ready = true;
    if (DateTime.fromISO(this.project.commentingClosedDate).diff(DateTime.fromISO(this.project.commentingOpenDate), 'days').as('days') < 30) {
      ready = false;
      this.modalSvc.openWarningDialog('Comment End Date must be at least 30 days after Comment Start Date when "Publish" is pushed.');
    }

    if (!this.spatialDetail || this.spatialDetail.length == 0) {
      ready = false;
      this.modalSvc.openWarningDialog('Proposed FOM spatial file should be uploaded before "Publish" is pushed.');
    }

    if(DateTime.fromISO(this.project.commentingOpenDate).diff(DateTime.fromJSDate(this.today), 'days').as('days') < 1){
      ready = false;
      this.modalSvc.openWarningDialog('Comment Start Date must be at least one day after "Publish" is pushed.');
    }
    return ready;
  }

  private subscribeToFeatureSelectChange(): void {
    // Scroll to top map detail section when feature is selected from the list.
    this.fss.$currentSelected
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(featureIndex => {
        if (featureIndex) {
          setTimeout(() => {
            this.scrollContainer.nativeElement.scrollTop = 200;
          }, 500); // Delay scroll to top timing for seeing highted row for user experience.
        }
      });
  }
}