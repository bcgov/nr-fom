
import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { COMMENT_STATUS_FILTER_PARAMS, FOMFiltersService, FOM_FILTER_NAME } from '@public-core/services/fomFilters.service';
import { UrlService } from '@public-core/services/url.service';
import { DateTime } from "luxon";
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { IUpdateEvent } from '../projects.component';
import { Filter, FilterUtils, IMultiFilterFields, MultiFilter } from '../utils/filter';


/**
 * Find side panel.
 *
 * @export
 * @class FindPanelComponent
 */
@Component({
  imports: [
    FormsModule,
    BsDatepickerModule
],
  selector: 'app-find-panel',
  templateUrl: './find-panel.component.html',
  styleUrl: './find-panel.component.scss'
})
export class FindPanelComponent {
  urlSvc = inject(UrlService);
  private fomFiltersSvc = inject(FOMFiltersService);

  readonly update = output<IUpdateEvent>();
  readonly loading = input<boolean | undefined>(undefined); // from projects component

  public filterHash: string;

  /**
   * The shared filter set, owned by `FOMFiltersService` and read here as a signal.
   *
   * The service re-emits a whole new `Map` on every change (including changes made elsewhere, such as the
   * Clear button on the projects view), so this panel must re-read its filters on each emission rather
   * than hold its own copies.
   *
   * `requireSync` is safe because `filters$` is backed by a `BehaviorSubject` — a current value always
   * exists, so the panel is never in a "no filters yet" state and needs no placeholder defaults.
   */
  private readonly fomFilters = toSignal(this.fomFiltersSvc.filters$, { requireSync: true });

  /**
   * The four individual filters, derived from the shared set. Reading these in the template is what makes
   * the panel re-render when the filter set is replaced externally; the objects themselves are the
   * service's, so mutating `.value` (via `ngModel` or the helpers below) edits the shared filter directly,
   * exactly as before.
   */
  readonly fomNumberFilter = computed(() => this.fomFilters().get(FOM_FILTER_NAME.FOM_NUMBER) as Filter<number>);
  readonly forestClientNameFilter = computed(() => this.fomFilters().get(FOM_FILTER_NAME.FOREST_CLIENT_NAME) as Filter<string>);
  readonly commentStatusFilters = computed(() => this.fomFilters().get(FOM_FILTER_NAME.COMMENT_STATUS) as MultiFilter<boolean>); // For 'Commenting Open' or 'Commenting Closed'.
  readonly postedOnAfterFilter = computed(() => this.fomFilters().get(FOM_FILTER_NAME.POSTED_ON_AFTER) as Filter<Date>);

  readonly minDate = DateTime.fromISO('2018-03-23').toJSDate(); // first app created
  readonly maxDate = DateTime.now().toJSDate(); // today
  readonly maxInputLength = 9;

  /**
   * Computes a hash based on the current filters, updates the local filterHash value if the newly computed hash is
   * different from the current hash, and returns true if the hash was updated, or false otherwise.
   *
   * @returns {boolean}
   * @memberof FindPanelComponent
   */
  public checkAndSetFiltersHash(): boolean {
    const newFilterHash = FilterUtils.hashFilters(
      this.fomNumberFilter(),
      this.forestClientNameFilter(),
      this.commentStatusFilters(),
      this.postedOnAfterFilter());

    if (this.filterHash === newFilterHash) {
      return false;
    }

    this.filterHash = newFilterHash;
    return true;
  }

  /**
   * Toggles the filters boolean value.
   *
   * @param {IMultiFilterFields} filter
   * @memberof ExplorePanelComponent
   */
  public toggleFilter(filter: IMultiFilterFields<boolean>) {
    filter.value = !filter.value;
  }

  // checking if Comment Status filter both COMMENT_OPEN/COMMENT_CLOSED are false. If it is, default to COMMENT_OPEN.
  public verifyStatus() {
    const statusFilters = this.commentStatusFilters().filters;
    const commentOpen = statusFilters.filter(filter => filter.queryParam == COMMENT_STATUS_FILTER_PARAMS.COMMENT_OPEN)[0];
    const commentClosed = statusFilters.filter(filter => filter.queryParam == COMMENT_STATUS_FILTER_PARAMS.COMMENT_CLOSED)[0];
    if (!commentOpen.value && !commentClosed.value) {
      commentOpen.value = true;
    }
  }

  public verifyFomNumberInput(event: Event) {
    let parsed: number | null = parseInt((event.target as HTMLInputElement).value.toString().replace(/^0+(?=\d)/, ''), 10);
    // fomNumber search field is a positive integer excluding 0;
    if (isNaN(parsed) || parsed == 0) {
        parsed = null;
    }
    this.fomNumberFilter().filter.value = parsed;
  }

  /**
   * Emit the current selected filters to the parent, if the filters have changed since the last time emit was called.
   *
   * @memberof FindPanelComponent
   */
  public emitUpdate(updateEventOptions: IUpdateEvent) {
    if (this.checkAndSetFiltersHash()) {
      this.update.emit({ ...updateEventOptions });
    }
  }

  /**
   * Saves the currently selected filters to the url and emits them to the parent.
   *
   * @memberof FindPanelComponent
   */
  public applyAllFilters() {
    this.fomFiltersSvc.updateFiltersSelection(this.fomFilters());
    this.emitUpdate({ search: true, resetMap: false, hidePanel: true });
  }

  /**
   * Saves the currently selected filters to the url and emits them to the parent.
   *
   * @memberof ExplorePanelComponent
   */
  public applyAllFiltersMobile() {
    this.fomFiltersSvc.updateFiltersSelection(this.fomFilters());
    this.emitUpdate({ search: true, resetMap: false, hidePanel: true });
  }

  /**
   * Resets all filters to their default (null, empty) values.
   * Removes the query parameters from the url.
   *
   * @memberof FindPanelComponent
   */
  public clear() {
    this.clearAllFilters();
    this.emitUpdate({ search: true, resetMap: true, hidePanel: true });
  }

  /**
   * Resets all filters to their default (null, empty) values.
   *
   * @memberof FindPanelComponent
   */
  public clearAllFilters() {
    this.fomFiltersSvc.clearFilters();
  }
  /**
   * Returns true if at least 1 filter is selected/populated, false otherwise.
   *
   * @returns {boolean}
   * @memberof FindPanelComponent
   */
  public areFiltersSet(): boolean {
    return this.forestClientNameFilter().isFilterSet();
  }
}
