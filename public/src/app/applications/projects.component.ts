import { Component, DestroyRef, Injector, OnDestroy, OnInit, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

import { Observable } from 'rxjs';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';

import { FormsModule } from '@angular/forms';
import { ProjectPublicSummaryResponse, ProjectService } from '@api-client';
import { COMMENT_STATUS_FILTER_PARAMS, FOMFiltersService, FOM_FILTER_NAME } from '@public-core/services/fomFilters.service';
import { UrlService } from '@public-core/services/url.service';
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
  imports: [
    FormsModule,
    FindPanelComponent,
    DetailsPanelComponent,
    PublicNoticesPanelComponent,
    AppMapComponent
  ],
  selector: 'app-projects',
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss'
})
export class ProjectsComponent implements OnInit, OnDestroy {
  private modalService = inject(NgbModal);
  private router = inject(Router);
  private projectService = inject(ProjectService);
  urlService = inject(UrlService);
  private fomFiltersSvc = inject(FOMFiltersService);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);

  readonly appmap = viewChild<AppMapComponent>('appmap');
  readonly findPanel = viewChild<FindPanelComponent>('findPanel');
  readonly detailsPanel = viewChild<DetailsPanelComponent>('detailsPanel');
  readonly publicNoticesPanel = viewChild<PublicNoticesPanelComponent>('publicNoticesPanel');

  private splashModal: NgbModalRef | null = null;
  private fragmentTimeout: any;

  // necessary to allow referencing the enum in the html
  public Panel = Panel;

  // indicates which side panel should be shown
  readonly activePanel = signal<Panel | null | undefined>(undefined);

  // Active filters, and the FOM list fetched reactively from them. `loading` is this fetch's own
  // in-flight state (per-resource, not the global interceptor loading), so it won't react to
  // unrelated requests (map tiles, code tables, public notices).
  private readonly filters = toSignal(this.fomFiltersSvc.filters$);
  private readonly projectsResource = rxResource({
    params: () => this.filters(),
    stream: ({ params }) => this.fetchFOMs(params),
  });
  readonly projectsSummary = computed<Array<ProjectPublicSummaryResponse> | undefined>(() =>
    this.projectsResource.hasValue() ? this.projectsResource.value() : undefined);
  readonly totalNumber = computed(() => this.projectsSummary()?.length ?? 0);
  readonly loading = this.projectsResource.isLoading;
  readonly commentStatusFilters = computed(() =>
    this.filters()?.get(FOM_FILTER_NAME.COMMENT_STATUS) as MultiFilter<boolean>);

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
  }

  private handleFragment(fragment: string | null) {
    if (this.fragmentTimeout) {
      clearTimeout(this.fragmentTimeout);
    }
    this.fragmentTimeout = setTimeout(() => {
      switch (fragment) {
        case 'splash':
          this.displaySplashModal();
          break;
        case Panel.find:
          this.closeSplashModal();
          this.activePanel.set(Panel.find);
          break;
        case Panel.details:
          this.closeSplashModal();
          this.activePanel.set(Panel.details);
          break;
        default:
          this.closeSplashModal();
          break;
      }
      // activePanel is a signal, so the side panel opens/closes reactively when it is set above
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
    // Closing the splash modal doesn't resize the map container, so the map's own
    // ResizeObserver won't fire; refresh it once the post-close render has painted.
    afterNextRender(() => this.appmap()?.invalidateSize(), { injector: this.injector });
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
    if (this.activePanel()) {
      this.activePanel.set(null);
      this.urlService.setFragment(null);
    }
  }

  private fetchFOMs(fomFilters: Map<string, IFilter | IMultiFilter>): Observable<Array<ProjectPublicSummaryResponse>> {
    const fomNumberParam = (fomFilters.get(FOM_FILTER_NAME.FOM_NUMBER) as Filter<number>).filter.value;
    const forestClientNameParam = (fomFilters.get(FOM_FILTER_NAME.FOREST_CLIENT_NAME) as Filter<string>).filter.value;
    const commentStatusFilters = (fomFilters.get(FOM_FILTER_NAME.COMMENT_STATUS) as MultiFilter<boolean>).filters as Array<IMultiFilterFields<boolean>>;
    const commentOpenParam = commentStatusFilters.filter(filter => filter.queryParam == COMMENT_STATUS_FILTER_PARAMS.COMMENT_OPEN)[0].value;
    const commentClosedParam = commentStatusFilters.filter(filter => filter.queryParam == COMMENT_STATUS_FILTER_PARAMS.COMMENT_CLOSED)[0].value;
    const openedOnOrAfterParam = (fomFilters.get(FOM_FILTER_NAME.POSTED_ON_AFTER) as Filter<Date>).filter.value?.toISOString().substring(0, 10);

    return this.projectService
        .projectControllerFindPublicSummary(
          fomNumberParam?.toString(),
          commentOpenParam?.toString(),
          commentClosedParam?.toString(),
          forestClientNameParam ?? undefined,
          openedOnOrAfterParam);
  }

  /**
   * Event handler called when Find panel emits an update.
   *
   * @param {IUpdateEvent} updateEvent
   * @memberof ProjectsComponent
   */
  public handleFindUpdate(updateEvent: IUpdateEvent) {

    const appmap = this.appmap();
    if (updateEvent.search) {
      this.detailsPanel()?.clearAllFilters();

      if (appmap) {
        appmap.unhighlightApplications();
      }
    }

    if (updateEvent.resetMap) {
      appmap?.resetView(false);
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
    if (this.activePanel() === panel) {
      this.activePanel.set(null);
      this.urlService.setFragment(null);
    } else {
      this.activePanel.set(panel);
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
    if (this.loading()) return;
    filter.value = !filter.value;
    this.fomFiltersSvc.updateFilterSelection(FOM_FILTER_NAME.COMMENT_STATUS, this.commentStatusFilters());
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
