import { ChangeDetectorRef, Component, DestroyRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

import { Observable, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectPublicSummaryResponse, ProjectService } from '@api-client';
import { COMMENT_STATUS_FILTER_PARAMS, FOMFiltersService, FOM_FILTER_NAME } from '@public-core/services/fomFilters.service';
import { UrlService } from '@public-core/services/url.service';
import { takeUntil } from 'rxjs/operators';
import { AppMapComponent } from './app-map/app-map.component';
import { PublicNoticesPanelComponent } from './app-public-notices/public-notices-panel.component';
import { DetailsPanelComponent } from './details-panel/details-panel.component';
import { FindPanelComponent } from './find-panel/find-panel.component';
import { SplashModalComponent } from './splash-modal/splash-modal.component';
import { Filter, IFilter, IMultiFilter, IMultiFilterFields, MultiFilter } from './utils/filter';
import { Panel } from './utils/panel.enum';

/**
 * Object emitted by child panel on update.
 *
 * @export
 * @interface IUpdateEvent
 */
export interface IUpdateEvent {

  // True if the search was manually initiated (button click), false if it is emitting as part of component initiation.
  search?: boolean;

  // True if the map view should be reset
  resetMap?: boolean;

  // True if the panel should be collapsed
  hidePanel?: boolean;
}

/**
 * Main public site component.
 *
 * @export
 * @class ProjectsComponent
 * @implements {OnInit}
 * @implements {AfterViewInit}
 * @implements {OnDestroy}
 */
@Component({
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    FindPanelComponent,
    DetailsPanelComponent,
    PublicNoticesPanelComponent,
    AppMapComponent
  ],
  selector: 'app-projects',
  templateUrl: './projects.component.html',
  styleUrls: ['./projects.component.scss']
})
export class ProjectsComponent implements OnInit, OnDestroy {
  @ViewChild('appmap', { static: false }) appmap: AppMapComponent;
  @ViewChild('findPanel', { static: false }) findPanel: FindPanelComponent;
  @ViewChild('detailsPanel', { static: false }) detailsPanel: DetailsPanelComponent;
  @ViewChild('publicNoticesPanel', { static: false }) publicNoticesPanel: PublicNoticesPanelComponent;

  private splashModal: NgbModalRef = null;
  private fragmentTimeout: any;

  // necessary to allow referencing the enum in the html
  public Panel = Panel;

  // indicates which side panel should be shown
  public activePanel: Panel;
  public loading = false;
  public urlTree: UrlTree;
  public observablesSub: Subscription = null;
  public coordinates: string = null;
  public projectsSummary: Array<ProjectPublicSummaryResponse>;
  public projectsSummary$: Observable<Array<ProjectPublicSummaryResponse>>;
  public totalNumber: number;
  public commentStatusFilters: MultiFilter<boolean>;
  
  constructor(
    private modalService: NgbModal,
    private router: Router,
    private projectService: ProjectService,
    public urlService: UrlService,
    private fomFiltersSvc: FOMFiltersService,
    private changeDetectorRef: ChangeDetectorRef,
    private destroyRef: DestroyRef
  ) { }

  /**
   * @memberof ProjectsComponent
   */
  ngOnInit() {
    // watch for URL param changes
    this.urlService.onNavEnd$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      const fragment = this.router.parseUrl(event.url).fragment || this.router.parseUrl(this.router.url).fragment;
      this.handleFragment(fragment);
    });

    // Check initial fragment
    const initialFragment = this.router.parseUrl(this.router.url).fragment;
    if (initialFragment) {
      this.handleFragment(initialFragment);
    }

    this.fomFiltersSvc.filters$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((filters) => {
      this.fetchFOMs(filters);
      this.commentStatusFilters = filters.get(FOM_FILTER_NAME.COMMENT_STATUS) as MultiFilter<boolean>;
    });
  }

  private handleFragment(fragment: string) {
    if (this.fragmentTimeout) {
      clearTimeout(this.fragmentTimeout);
    }
    this.fragmentTimeout = setTimeout(() => {
      this.urlTree = this.router.parseUrl(this.router.url);
      switch (fragment) {
        case 'splash':
          this.displaySplashModal();
          break;
        case Panel.find:
          this.closeSplashModal();
          this.activePanel = Panel.find;
          break;
        case Panel.details:
          this.closeSplashModal();
          this.activePanel = Panel.details;
          break;
        default:
          this.closeSplashModal();
          break;
      }
    });
  }

  public displaySplashModal(): void {
    if (this.splashModal) return; // already open
    this.splashModal = this.modalService.open(SplashModalComponent, {
      backdrop: 'static',
      windowClass: 'splash-modal'
    });

    this.splashModal.result.then(() => {
      this.splashModal = null;
      this.invalidateMapSize();
    }, () => {
      this.splashModal = null;
      this.invalidateMapSize();
    });
  }

  private invalidateMapSize() {
    setTimeout(() => {
      if (this.appmap) {
        this.appmap.invalidateSize();
      }
    }, 250);
  }

  /**
   * Closes the splash modal if its open.
   *
   * @memberof ProjectsComponent
   */
  public closeSplashModal(): void {
    if (this.splashModal) {
      this.splashModal.close();
    }
  }

  /**
   * Removes any url fragment.
   *
   * @memberof ProjectsComponent
   */
  public closeSidePanel() {
    if (this.activePanel) {
      this.activePanel = null;
      this.urlService.setFragment(null);
    }
  }

  fetchFOMs(fomFilters: Map<string, IFilter | IMultiFilter>) {
    const fomNumberParam = (fomFilters.get(FOM_FILTER_NAME.FOM_NUMBER) as Filter<number>).filter.value;
    const forestClientNameParam = (fomFilters.get(FOM_FILTER_NAME.FOREST_CLIENT_NAME) as Filter<string>).filter.value;
    const commentStatusFilters = fomFilters.get(FOM_FILTER_NAME.COMMENT_STATUS)['filters'] as Array<IMultiFilterFields<boolean>>;
    const commentOpenParam = commentStatusFilters.filter(filter => filter.queryParam == COMMENT_STATUS_FILTER_PARAMS.COMMENT_OPEN)[0].value;
    const commentClosedParam = commentStatusFilters.filter(filter => filter.queryParam == COMMENT_STATUS_FILTER_PARAMS.COMMENT_CLOSED)[0].value;
    const openedOnOrAfterParam = (fomFilters.get(FOM_FILTER_NAME.POSTED_ON_AFTER) as Filter<Date>).filter.value?.toISOString().substring(0, 10);

    this.loading = true;
    this.projectService
        .projectControllerFindPublicSummary(
          fomNumberParam?.toString(),
          commentOpenParam.toString(), 
          commentClosedParam.toString(), 
          forestClientNameParam, 
          openedOnOrAfterParam)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((results) => {
          this.projectsSummary = results;
          this.totalNumber = results.length;
          this.loading = false;
          this.changeDetectorRef.detectChanges();
          },
          () => {
            this.loading = false;
            this.changeDetectorRef.detectChanges();
          },
          () => {
            this.loading = false;
            this.changeDetectorRef.detectChanges();
          }
        );
  }

  /**
   * Event handler called when Find panel emits an update.
   *
   * @param {IUpdateEvent} updateEvent
   * @memberof ProjectsComponent
   */
  public handleFindUpdate(updateEvent: IUpdateEvent) {

    if (updateEvent.search) {
      this.detailsPanel.clearAllFilters();

      if (this.appmap) {
        this.appmap.unhighlightApplications();
      }
    }

    if (updateEvent.resetMap) {
      this.appmap.resetView(false);
    }

    if (updateEvent.hidePanel) {
      this.closeSidePanel();
    }
  }

  public handlePublicNoticesUpdate(updateEvent: IUpdateEvent) {
    if (updateEvent.hidePanel) {
      this.closeSidePanel();
    }
  }
  

  /**
   * Toggles active panel and its corresponding url fragment.
   *
   * @param {Panel} panel panel/fragment to toggle
   * @memberof ProjectsComponent
   */
  public togglePanel(panel: Panel) {
    if (this.urlTree.fragment === panel) {
      this.activePanel = null;
      this.urlService.setFragment(null);
    } else {
      this.activePanel = panel;
      this.urlService.setFragment(panel);
    }
  }

  /**
   * Clears all child component filters and re-fetches FOMs.
   *
   * @memberof ProjectsComponent
   */
  public clearFilters() {
    this.fomFiltersSvc.clearFilters();
  }

  public toggleFilter(filter: IMultiFilterFields<boolean>) {
    if (this.loading) return;
    filter.value = !filter.value;
    this.fomFiltersSvc.updateFilterSelection(FOM_FILTER_NAME.COMMENT_STATUS, this.commentStatusFilters);
  }
  
  /**
   * On component destroy.
   *
   * @memberof ProjectsComponent
   */
  ngOnDestroy() {
    if (this.fragmentTimeout) {
      clearTimeout(this.fragmentTimeout);
    }
    if (this.splashModal) {
      this.splashModal.dismiss();
    }
  }
}
