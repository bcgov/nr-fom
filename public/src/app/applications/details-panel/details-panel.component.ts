import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
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
import { take, takeUntil } from 'rxjs/operators';
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
  standalone: true,
  imports: [
    FontAwesomeModule, CommonModule, ShapeInfoComponent, 
    DetailsMapComponent, TooltipModule, MatTooltipModule
  ],
  selector: 'app-details-panel',
  templateUrl: './details-panel.component.html',
  styleUrls: ['./details-panel.component.scss']
})
export class DetailsPanelComponent implements OnDestroy, OnInit {
  @Output() update = new EventEmitter();
  @ViewChild('panelScrollContainer')
  public panelScrollContainer: ElementRef;

  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();
  public addCommentModal: NgbModalRef = null;
  public isAppLoading: boolean;
  public project: ProjectResponse;
  public projectSpatialDetail: SpatialFeaturePublicResponse[];
  public currentPeriodDaysRemainingCount = 0;
  public workflowStatus: Record<string, WorkflowStateCode>
  public projectIdFilter = new Filter<string>({ filter: { queryParam: 'id', value: null } });
  public attachments: AttachmentResponse[];
  public faArrowUpRightFromSquare = faArrowUpRightFromSquare;
  public getCommentingClosingDate = getCommentingClosingDate;
  public periodOperationsTooltipTxt = "An FSP holder has three years to apply for a cutting permit or road permit for cutblocks and roads displayed on a FOM. This is called the validity period, it starts on the day commenting opens on a FOM. For BC Timber Sales the validity period starts on the day commenting closes.";
  readonly projectPlanCodeEnum = ProjectPlanCodeEnum;
  readonly periodOperationsTxt = periodOperationsTxt;
  readonly woodlotOperationsTxt = woodlotOperationsTxt;

  constructor(
    public modalService: NgbModal,
    public configService: ConfigService, // used in template
    public urlService: UrlService,
    private projectService: ProjectService,
    private spatialFeatureService: SpatialFeatureService,
    private attachmentService: AttachmentService,
    private fss: FeatureSelectService,
  ) {}

  ngOnInit(): void {
    // Note, can't seem to get stateService.ts to get codeTable working here. Instead, subscribe to it.
    // Subscribe to this first, seems to be slower and can cause minor page render issue due to no code.
    this.projectService.workflowStateCodeControllerFindAll()
    .pipe(take(1)).subscribe((data) => {
      this.workflowStatus = indexBy(data, (x) => x.code);
    });
    // First time component init. The `urlService.onNavEnd$` already ends, so 
    // do this initially first since queryParam is ready from route. 
    // Works if user has bookmarks the detail link.
    this.getProjectDetails();

    // Subscribe to onNavEnd so the component knows subsequent clicks on other details.
    this.urlService.onNavEnd$.pipe(takeUntil(this.ngUnsubscribe))
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
    const projectId = parseInt(this.projectIdFilter.filter.value);
    if (!projectId) {
      // no project to display
      this.project = null;
      return;
    }

    this.isAppLoading = true;
    forkJoin({
      project: this.projectService.projectControllerFindOne(projectId),
      spatialDetail: this.spatialFeatureService.spatialFeatureControllerGetForProject(projectId),
      attachments: this.attachmentService.attachmentControllerFind(projectId)
    })
    .pipe(takeUntil(this.ngUnsubscribe))
    .subscribe({
      next: (results) => {
        this.project = results.project;
        this.projectSpatialDetail = results.spatialDetail;
        this.attachments = results.attachments.sort(
            (a, b) => a.attachmentType.code.localeCompare(b.attachmentType.code)
        );
        this.isAppLoading = false;
        this.projectIdFilter.filter.value = this.project.id.toString();
        this.saveQueryParameters();
        this.update.emit(this.project);
      },
      error: (err) => {
        console.error(err);
        this.isAppLoading = false;
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
    
    let modalInstance = this.addCommentModal.componentInstance as CommentModalComponent;
    modalInstance.projectId = this.project.id;
    modalInstance.projectSpatialDetail = this.projectSpatialDetail;

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
    this.fss.$currentSelected
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(featureIndex => {
        if (featureIndex) {
          setTimeout(() => {
            this.panelScrollContainer.nativeElement.scrollTop = 100;
          }, 500); // Delay scroll to top timing for seeing highted row for user experience.
        }
      });
  }

  // Used for (click) event from <a>/<button> at Angular page to download a file.
  public async getFileContents(fileId: number, filename: string): Promise<void> {
    this.attachmentService.attachmentControllerGetFileContents(fileId)
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
    this.ngUnsubscribe.next(null);
    this.ngUnsubscribe.complete();
  }
}
