import { AttachmentResolverSvc } from "@admin-core/services/AttachmentResolverSvc";
import { CognitoService } from "@admin-core/services/cognito.service";
import { ModalService } from '@admin-core/services/modal.service';
import { Component, ElementRef, Injector, OnInit, effect, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AttachmentResponse, ProjectMetricsResponse, ProjectPlanCodeEnum, ProjectResponse, ProjectService, ProjectWorkflowStateChangeRequest, SpatialFeaturePublicResponse, WorkflowStateEnum } from "@api-client";
import { NgbModal, NgbModalRef, NgbModule, NgbNav } from '@ng-bootstrap/ng-bootstrap';
import { User } from "@utility/security/user";
import { FeatureSelectService } from '@utility/services/featureSelect.service';
import { DateTime } from "luxon";
import { firstValueFrom } from 'rxjs';
import { EnddateChangeModalComponent } from './enddate-change-modal/enddate-change-modal.component';

import { NewlinesPipe } from "@admin-core/pipes/newlines.pipe";
import { DatePipe } from "@angular/common";
import { DetailsMapComponent } from "../details-map/details-map.component";
import { ShapeInfoComponent } from "../shape-info/shape-info.component";

@Component({
    imports: [
    RouterLink,
    NgbNav,
    NgbModule,
    DetailsMapComponent,
    ShapeInfoComponent,
    DatePipe,
    NewlinesPipe
],
    selector: 'app-application-detail',
    templateUrl: './fom-detail.component.html',
    styleUrl: './fom-detail.component.scss'
})
export class FomDetailComponent implements OnInit {
  private router = inject(Router);
  private modalSvc = inject(ModalService);
  projectService = inject(ProjectService);
  attachmentResolverSvc = inject(AttachmentResolverSvc);
  private cognitoService = inject(CognitoService);
  private ngbModalService = inject(NgbModal);
  private fss = inject(FeatureSelectService);
  private injector = inject(Injector);

  readonly projectPlanCodeEnum = ProjectPlanCodeEnum;
  public readonly scrollContainer = viewChild<ElementRef>('scrollContainer');
  
  public changeEndDateModal : NgbModalRef | null = null;
  public readonly isPublishing = signal(false);
  public readonly isDeleting = signal(false);
  public readonly isFinalizing = signal(false);
  public isRefreshing = false;
  public readonly isSettingCommentClassification = signal(false);
  public application: ProjectResponse | null = null;
  /**
   * The FOM on display: seeded from the route resolver input, then replaced in place by
   * `refreshProject()` after an update that should not reload the whole page.
   *
   * `linkedSignal` re-seeds from the input if it ever changes, which would discard a refetched
   * value — safe here because the constructor opts this route out of component reuse, so a new
   * FOM always means a new component instance.
   */
  readonly project = linkedSignal<ProjectResponse>(() => this.projectDetail());
  // Route resolver data, bound as inputs (a/:appId resolve keys).
  readonly projectDetail = input.required<ProjectResponse>();
  readonly spatialDetail = input.required<SpatialFeaturePublicResponse[]>();
  readonly projectMetrics = input.required<ProjectMetricsResponse>();
  public isProjectActive = false;
  public readonly attachments = signal<AttachmentResponse[]>([]);
  // Populated from the authenticated Cognito session in the constructor.
  public user!: User;
  public daysRemaining: number | null = null;
  private workflowStateChangeRequest: ProjectWorkflowStateChangeRequest = <ProjectWorkflowStateChangeRequest>{};
  private now = new Date();
  private today = new Date(this.now.getFullYear(), this.now.getMonth(), this.now.getDate());

  constructor() {
    const user = this.cognitoService.getUser();
    if (user) {
      this.user = user;
    }
    this.router.routeReuseStrategy.shouldReuseRoute = () => false;
  }

  ngOnInit() {
    // route resolver data is bound to inputs (projectDetail/spatialDetail/projectMetrics)
    const projectDetail = this.projectDetail();
    if (projectDetail) {
      this.initProjectDetail(projectDetail);
    } else {
      alert("Uh-oh, couldn't load fom");
      // application not found --> navigate back to search
      this.router.navigate(['/search']);
    }

    this.attachmentResolverSvc.getAttachments(this.project().id)
      .then( (result) => {
        //Sorting by Public Notice and Supporting Document
        this.attachments.set([...result].sort((a,b) => (a.attachmentType.code < b.attachmentType.code? -1 : 1)));
      }).catch((error) => {
      console.error(error);
    });

    this.subscribeToFeatureSelectChange();
  }

  public deleteAttachment(id: number) {
    const dialogRef = this.modalSvc.openConfirmationDialog(`You are about to delete this attachment. Are you sure?`, 'Delete Attachment');
    dialogRef.afterClosed().subscribe((confirm) => {
      if (confirm) {
        const result = this.attachmentResolverSvc.attachmentControllerRemove(id);
        result.then( () => {
          return this.onSuccess();
        }).catch( (error) => {
          console.error(error);
        })
      }
    })
  }

  onSuccess() {
    this.router.navigate([`a/${this.project().id}`])
      .then( () => {
        window.location.reload();
      })
  }

  deleteFOM() {
    const dialogRef = this.modalSvc.openConfirmationDialog(`You are about to withdraw FOM ${this.project().id} - ${this.project().name}. Are you sure?`, 'Withdraw FOM');
    dialogRef.afterClosed().subscribe((confirm) => {
      if (confirm) {
        this.isDeleting.set(true);
        this.projectService.projectControllerRemove(this.project().id)
        .subscribe(
          ()=> {
            this.isDeleting.set(false);
            this.router.navigate(['/search']); // Delete successfully, back to search.
          },
          (error) => {
            this.isDeleting.set(false);
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
        this.isFinalizing.set(true);
        this.projectService.projectControllerStateChange(
            this.project().id,
            {
              workflowStateCode: WorkflowStateEnum.Finalized,
              revisionCount: this.project().revisionCount
            }
        )
        .subscribe(
          (_result)=> {
            this.isFinalizing.set(false);
            this.onSuccess();
          },
          (error) => {
            this.isFinalizing.set(false);
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
          this.workflowStateChangeRequest.revisionCount = this.project().revisionCount;

          this.isPublishing.set(true);
          try {
            await this.projectService.projectControllerStateChange(this.project().id, this.workflowStateChangeRequest).toPromise();
          } finally {
            this.isPublishing.set(false);
          }
          this.onSuccess()
        }
      }
    })
  }

  public goToPublicNotice() {
    if (this.canEditPublicNotice()) {
      this.router.navigate([`publicNotice/${this.project().id}/edit`])
    }
    else {
      this.router.navigate([`publicNotice/${this.project().id}`])
    }
  }

  public async setCommentClassification() {
    this.isSettingCommentClassification.set(true);
    try {
      await this.projectService.projectControllerCommentClassificationMandatoryChange(
        this.project().id, 
        {
          commentClassificationMandatory: !this.project().commentClassificationMandatory,
          revisionCount: this.project().revisionCount
        })
      .toPromise();

      // in this case trigger 'this.project' update locally instead of using // this.onSuccess(); which refresh whole page.
      await this.refreshProject();
    } 
    catch(error) {
      console.error(error);
    } finally {
      this.isSettingCommentClassification.set(false);
    }
  }

  /**
    INITIAL: holder can withdraw.
    PUBLISH/COMMENT_OPEN: no actions.
    COMMENT_CLOSED/FINALIZED/EXPIRED: gov
  */
  public canWithdraw() {
    const workflowStateCode = this.project().workflowState.code;
    if (WorkflowStateEnum.Initial === workflowStateCode) {
      return this.user.isAuthorizedForClientId(this.project().forestClient.id);
    }
    else if (!this.user.isMinistry) {
      return false;
    }

    return [WorkflowStateEnum.CommentClosed, WorkflowStateEnum.Finalized, WorkflowStateEnum.Expired]
            .includes(workflowStateCode as WorkflowStateEnum);
  }

  public canFinalize() {
    return this.user.isAuthorizedForClientId(this.project().forestClient.id)
    && this.project().workflowState.code === WorkflowStateEnum.CommentClosed;
  }

  public canAccessComments(): boolean {
    const userCanView = this.user.isMinistry || this.user.isAuthorizedForClientId(this.project().forestClient.id);
    return userCanView && (this.project().workflowState.code !== WorkflowStateEnum.Initial
                        && this.project().workflowState.code !== WorkflowStateEnum.Published);
  }

  public canChangeEndDate(): boolean {
    return this.user.isMinistry && 
        (this.project().workflowState.code == WorkflowStateEnum.Initial
            || this.project().workflowState.code == WorkflowStateEnum.CommentOpen
        ) && !!this.project().commentingOpenDate;
  }

  public canEditFOM(): boolean {
    const userCanEdit = this.user.isAuthorizedForClientId(this.project().forestClient.id);
    return userCanEdit && (this.project().workflowState.code !== WorkflowStateEnum.Published
      && this.project().workflowState.code !== WorkflowStateEnum.Finalized
      && this.project().workflowState.code !== WorkflowStateEnum.Expired);
  }

  public canEditPublicNotice(): boolean {
    const userCanEdit = this.user.isAuthorizedForClientId(this.project().forestClient.id);
    return userCanEdit && this.project().workflowState.code === WorkflowStateEnum.Initial;
  }

  public canViewPublicNotice(): boolean {
    return this.user.isAuthorizedForClientId(this.project().forestClient.id)
            || this.user.isMinistry;
  }

  public canViewSubmission(): boolean {
    const userCanView = this.user.isAuthorizedForClientId(this.project().forestClient.id);
    return userCanView && (this.project().workflowState.code === WorkflowStateEnum.Initial
      || this.project().workflowState.code === WorkflowStateEnum.CommentClosed);
  }

  public canViewPublishing(): boolean {
    return this.user.isAuthorizedForClientId(this.project().forestClient.id)
      && this.project().workflowState.code === WorkflowStateEnum.Initial;
  }

  public canAccessInteractions(): boolean {
    return this.canAccessComments(); // same as comments for access/viewing.
  }

  public isDeleteAttachmentAllowed(attachment: AttachmentResponse) {
    return this.attachmentResolverSvc.isDeleteAttachmentAllowed(attachment.attachmentType.code, this.project().workflowState.code);
  }

  public canSetCommentClassification() {
    return this.user.isMinistry && 
          (this.project().workflowState.code == WorkflowStateEnum.CommentOpen
          || this.project().workflowState.code == WorkflowStateEnum.CommentClosed);
  }

  public openChangeEndDateModal() {
        // open modal
        this.changeEndDateModal = this.ngbModalService.open(EnddateChangeModalComponent, {
          backdrop: 'static',
          size: 'modal-sm', //or sm
          windowClass: 'enddate-change-modal' // Important! See endate-change-modal.component.scss for explanation.
        });
        
        const modalInstance = this.changeEndDateModal.componentInstance as EnddateChangeModalComponent;
        modalInstance.projectId = this.project().id;
        modalInstance.currentCommentingClosedDate = this.project().commentingClosedDate;
        modalInstance.changeRequest.revisionCount = this.project().revisionCount;
        
        this.changeEndDateModal.result.then(
          (result) => {
            // check result
            if (result.projectUpdated) {
              void this.refreshProject();
            }
            this.changeEndDateModal = null;
          },
          () => {
            this.changeEndDateModal = null;
          }
        );
  }

  private initProjectDetail(project: ProjectResponse) {
    if (project.workflowState['code'] === 'INITIAL') {
      this.isProjectActive = true;
    }
    if (project.commentClassificationMandatory == undefined) {
      project.commentClassificationMandatory = true;
    }
    this.project.set(project);
    this.calculateDaysRemaining();
  }

  /**
   * Refetches this FOM and re-renders in place, for updates that should not reload the whole page.
   */
  private async refreshProject() {
    try {
      this.initProjectDetail(await firstValueFrom(this.projectService.projectControllerFindOne(this.project().id)));
    }
    catch (error) {
      console.error(error);
    }
  }

  private calculateDaysRemaining(){
    this.daysRemaining = (this.project().workflowState.code === WorkflowStateEnum.Initial) ?
    DateTime.fromISO(this.project().commentingClosedDate).diff(DateTime.fromISO(this.project().commentingOpenDate), 'days').as('days') :
    DateTime.fromISO(this.project().commentingClosedDate).diff(DateTime.fromJSDate(this.today), 'days').as('days');

    if(this.daysRemaining < 0){
      this.daysRemaining = 0;
    }
  }

  private validatePublishReady() {
    let ready = true;
    if (DateTime.fromISO(this.project().commentingClosedDate).diff(DateTime.fromISO(this.project().commentingOpenDate), 'days').as('days') < 30) {
      ready = false;
      this.modalSvc.openWarningDialog('Comment End Date must be at least 30 days after Comment Start Date when "Publish" is pushed.');
    }

    if (!this.spatialDetail() || this.spatialDetail().length == 0) {
      ready = false;
      this.modalSvc.openWarningDialog('Proposed FOM spatial file should be uploaded before "Publish" is pushed.');
    }

    if(DateTime.fromISO(this.project().commentingOpenDate).diff(DateTime.fromJSDate(this.today), 'days').as('days') < 1){
      ready = false;
      this.modalSvc.openWarningDialog('Comment Start Date must be at least one day after "Publish" is pushed.');
    }
    return ready;
  }

  private subscribeToFeatureSelectChange(): void {
    // Scroll to top map detail section when feature is selected from the list.
    effect(() => {
      const featureIndex = this.fss.currentSelected();
      if (featureIndex) {
        setTimeout(() => {
          const container = this.scrollContainer();
          if (container) {
            container.nativeElement.scrollTop = 200;
          }
        }, 500); // Delay scroll to top timing for seeing highted row for user experience.
      }
    }, { injector: this.injector });
  }
}