import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, Injector, OnDestroy, OnInit, effect, inject, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
    AttachmentResponse, AttachmentService, ProjectPlanCodeEnum, ProjectResponse, ProjectService,
    SpatialFeaturePublicResponse, SpatialFeatureService, WorkflowStateCode
} from '@api-client';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { periodOperationsTxt, woodlotOperationsTxt } from '@public-core/constants/appConstants';
import { UrlService } from '@public-core/services/url.service';
import { getCommentingClosingDate } from '@public-core/utils/appUtils';
import { ConfigService } from '@utility/services/config.service';
import { FeatureSelectService } from '@utility/services/featureSelect.service';
import { DetailsMapComponent } from 'app/applications/details-panel/details-map/details-map.component';
import { ShapeInfoComponent } from 'app/applications/details-panel/shape-info/shape-info.component';
import { saveAs } from "file-saver-es";
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import { indexBy } from 'remeda';
import { Subject, forkJoin } from 'rxjs';
import { take } from 'rxjs/operators';
import { CommentModalComponent } from '../../comment-modal/comment-modal.component';
import { Filter } from '../utils/filter';

/**
 * Details side panel.
 *
 * @export
 * @class DetailsPanelComponent
 * @implements {OnDestroy}
 */
@Component({
  imports: [
    FontAwesomeModule, DatePipe, TitleCasePipe, ShapeInfoComponent,
    DetailsMapComponent, TooltipModule, MatTooltipModule
  ],
  selector: 'app-details-panel',
  templateUrl: './details-panel.component.html',
  styleUrl: './details-panel.component.scss'
})
export class DetailsPanelComponent implements OnDestroy, OnInit {
  modalService = inject(NgbModal);
  configService = inject(ConfigService);
  urlService = inject(UrlService);
  private projectService = inject(ProjectService);
  private spatialFeatureService = inject(SpatialFeatureService);
  private attachmentService = inject(AttachmentService);
  private fss = inject(FeatureSelectService);
  private injector = inject(Injector);

  readonly update = output<ProjectResponse>();
  public readonly panelScrollContainer = viewChild<ElementRef>('panelScrollContainer');

  private destroyRef = inject(DestroyRef);
  public addCommentModal: NgbModalRef | null = null;
  // All five are written from async callbacks, so the view only learns about them through signals.
  public readonly isAppLoading = signal(false);
  public readonly project = signal<ProjectResponse | null>(null);
  public readonly projectSpatialDetail = signal<SpatialFeaturePublicResponse[]>([]);
  public currentPeriodDaysRemainingCount = 0;
  public readonly workflowStatus = signal<Record<string, WorkflowStateCode>>({});
  public projectIdFilter = new Filter<string>({ filter: { queryParam: 'id', value: null } });
  public readonly attachments = signal<AttachmentResponse[]>([]);
  public faArrowUpRightFromSquare = faArrowUpRightFromSquare;
  public getCommentingClosingDate = getCommentingClosingDate;
  public periodOperationsTooltipTxt = "An FSP holder has three years to apply for a cutting permit or road permit for cutblocks and roads displayed on a FOM. This is called the validity period, it starts on the day commenting opens on a FOM. For BC Timber Sales the validity period starts on the day commenting closes.";
  readonly projectPlanCodeEnum = ProjectPlanCodeEnum;
  readonly periodOperationsTxt = periodOperationsTxt;
  readonly woodlotOperationsTxt = woodlotOperationsTxt;

  ngOnInit(): void {
    // Note, can't seem to get stateService.ts to get codeTable working here. Instead, subscribe to it.
    // Subscribe to this first, seems to be slower and can cause minor page render issue due to no code.
    this.projectService.workflowStateCodeControllerFindAll()
    .pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      this.workflowStatus.set(indexBy(data, (x) => x.code));
    });
    // First time component init. The `urlService.onNavEnd$` already ends, so 
    // do this initially first since queryParam is ready from route. 
    // Works if user has bookmarks the detail link.
    this.getProjectDetails();

    // Subscribe to onNavEnd so the component knows subsequent clicks on other details.
    this.urlService.onNavEnd$.pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.getProjectDetails();
        });

    this.subscribeToFeatureSelectChange();
  }

  /**
   * Fetch project detail and spatial detail based on projectId.
   * @memberof DetailsPanelComponent
   */
  public getProjectDetails() {
    this.loadQueryParameters();
    const projectId = parseInt(this.projectIdFilter.filter.value ?? '');
    if (!projectId) {
      // no project to display
      this.project.set(null);
      return;
    }

    this.isAppLoading.set(true);
    forkJoin({
      project: this.projectService.projectControllerFindOne(projectId),
      spatialDetail: this.spatialFeatureService.spatialFeatureControllerGetForProject(projectId),
      attachments: this.attachmentService.attachmentControllerFind(projectId)
    })
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: (results) => {
        this.project.set(results.project);
        this.projectSpatialDetail.set(results.spatialDetail);
        this.attachments.set([...results.attachments].sort(
            (a, b) => a.attachmentType.code.localeCompare(b.attachmentType.code)
        ));
        this.isAppLoading.set(false);
        this.projectIdFilter.filter.value = results.project.id.toString();
        this.saveQueryParameters();
        this.update.emit(results.project);
      },
      error: (err) => {
        console.error(err);
        this.isAppLoading.set(false);
      }
    });
  }

  /**
   * Show the add comment modal.
   * @memberof DetailsPanelComponent
   */
  public addComment() {
    // open modal
    this.addCommentModal = this.modalService.open(CommentModalComponent, {
      backdrop: 'static',
      size: 'lg',
      windowClass: 'comment-modal'
    });
    
    const modalInstance = this.addCommentModal.componentInstance as CommentModalComponent;
    // addComment is only reachable from the details view when a project is loaded
    modalInstance.projectId = this.project()!.id;
    modalInstance.projectSpatialDetail = this.projectSpatialDetail();

    // check result
    this.addCommentModal.result.then(
      () => {
        // saved
        this.addCommentModal = null;
      },
      () => {
        // dismissed
        this.addCommentModal = null;
      }
    );
  }

  /**
   * Get any query parameters from the URL and updates the local filters accordingly.
   * @memberof DetailsPanelComponent
   */
  public loadQueryParameters(): void {
    this.projectIdFilter.filter.value = this.urlService.getQueryParam(this.projectIdFilter.filter.queryParam);
  }

  /**
   * Save the currently selected filters to the url.
   * @memberof DetailsPanelComponent
   */
  public saveQueryParameters() {
    this.urlService.setQueryParam(this.projectIdFilter.filter.queryParam, this.projectIdFilter.filter.value);
  }

  /**
   * Resets all filters to their default (null, empty) values.
   * @memberof DetailsPanelComponent
   */
  public clearAllFilters() {
    this.projectIdFilter.reset();
  }

  private subscribeToFeatureSelectChange(): void {
    // Scroll to top map detail section when feature is selected from the list.
    effect(() => {
      const featureIndex = this.fss.currentSelected();
      if (featureIndex) {
        setTimeout(() => {
          const el = this.panelScrollContainer()?.nativeElement;
          if (el) {
            el.scrollTop = 100;
          }
        }, 500); // Delay scroll to top timing for seeing highted row for user experience.
      }
    }, { injector: this.injector });
  }

  // Used for (click) event from <a>/<button> at Angular page to download a file.
  public async getFileContents(fileId: number, filename: string): Promise<void> {
    this.attachmentService.attachmentControllerGetFileContents(fileId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((value: Blob) => {
            const data: Blob = new Blob([value], {
                type: value.type
                });
                // file-saver:saveAs will download the file.
                saveAs(data, filename);
        });
    }

  /**
   * On component destroy.
   * @memberof DetailsPanelComponent
   */
  ngOnDestroy() {
    if (this.addCommentModal) {
      (this.addCommentModal.componentInstance as CommentModalComponent).dismiss('destroying');
    }
  }
}
