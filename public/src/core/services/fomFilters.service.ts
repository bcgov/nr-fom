import { Injectable } from '@angular/core';
import { AppUtils } from '@public-core/utils/appUtils';
import { BehaviorSubject, Observable } from 'rxjs';
import { Filter, IFilter, IMultiFilter, IMultiFilterFields, MultiFilter } from '../../app/applications/utils/filter';

export enum FOM_FILTER_NAME {
  FOM_NUMBER = 'fomNumber',
  FOREST_CLIENT_NAME = 'fcName',
  POSTED_ON_AFTER = 'pdOnAfter',
  COMMENT_STATUS = 'cmtStatus'
}

export const COMMENT_STATUS_FILTER_PARAMS = {
  COMMENT_OPEN: 'COMMENT_OPEN',
  COMMENT_CLOSED: 'COMMENT_CLOSED'
}

/*
  This const serve as default filters
  Note!! When getting this object, use copy of it 
        to prevent property value being overwritten from other components.
  The object for the properties are based on Interface from filter.ts.
  (However, that inteface definition is kind of strange, may need to review/refactor later.)
*/
export const DEFAULT_FOM_FILTERS = {
  fomNumberFilter: { filter: {queryParam: FOM_FILTER_NAME.FOM_NUMBER, value: null }},
  fcNameFilter: { filter: {queryParam: FOM_FILTER_NAME.FOREST_CLIENT_NAME, value: null }},
  postedOnAfterFilter: { filter: {queryParam: FOM_FILTER_NAME.POSTED_ON_AFTER, value: null }},
  commentStatusFilters: {
    queryParamsKey: FOM_FILTER_NAME.COMMENT_STATUS,
    filters: [
      { queryParam: COMMENT_STATUS_FILTER_PARAMS.COMMENT_OPEN, 
        displayString: 'Commenting Open', value: true },
      { queryParam: COMMENT_STATUS_FILTER_PARAMS.COMMENT_CLOSED, 
        displayString: 'Commenting Closed', value: false } // default value
    ]
  }
};

/**
 * Service to sync with FOM filters used by components.
 */
@Injectable({
    providedIn: 'root',
})
export class FOMFiltersService {

  private _filters$: BehaviorSubject<Map<string, IFilter|IMultiFilter>>;
  public filters$: Observable<Map<string, IFilter|IMultiFilter>>;

  constructor () {
    this._filters$ = new BehaviorSubject(this._getDefaultFilters());
    this.filters$ = this._filters$.asObservable();
  }

  updateFiltersSelection(newFilters: Map<string, IFilter|IMultiFilter>) {
    // Emit a fresh Map so reference-based consumers (e.g. projects.component's rxResource keyed on
    // toSignal(filters$)) always detect the change. Callers (the Find panel) often pass back the same
    // Map instance after mutating its filter values; re-emitting that identical reference would be
    // swallowed by a signal, dropping the search.
    const nextFilters = new Map(newFilters);
    this._resetCommentStatusFilter(nextFilters);
    this._filters$.next(nextFilters);
  }

  updateFilterSelection(filterName: string, filterToUpdate: IFilter|IMultiFilter) {
    if (!filterName || !(<string[]> Object.values(FOM_FILTER_NAME)).includes(filterName)) { // if we target ES7 in tsconfig, we don't need this cast.
      return; // wrong filter name, no update
    }

    const currentFilters = this._filters$.value;
    const nextFilters = new Map();
    currentFilters.forEach((currentFilter) => {
      let currentFilterName: string;
      if (currentFilter.hasOwnProperty('queryParamsKey')) {
        currentFilterName = currentFilter['queryParamsKey'];
      }
      else {
        currentFilterName = currentFilter['filter']['queryParam'];
      }

      if (currentFilterName === filterName) {
        nextFilters.set(currentFilterName, filterToUpdate);
      }
      else {
        nextFilters.set(currentFilterName, currentFilter);
      }
    });
    this._resetCommentStatusFilter(nextFilters);
    this._filters$.next(nextFilters);
  }

  clearFilters() {
    this._filters$.next(this._getDefaultFilters());
  }

  _getDefaultFilters(): Map<string, IFilter|IMultiFilter> {
    const defaultFilters = new Map();
    const fomNumberFilter = new Filter<string>(AppUtils.copy(DEFAULT_FOM_FILTERS.fomNumberFilter));
    const forestClientNameFilter = new Filter<string>(AppUtils.copy(DEFAULT_FOM_FILTERS.fcNameFilter));
    const postedOnAfterFilter = new Filter<Date>(AppUtils.copy(DEFAULT_FOM_FILTERS.postedOnAfterFilter));
    const commentStatusFilters = new MultiFilter<boolean>(AppUtils.copy(DEFAULT_FOM_FILTERS.commentStatusFilters));
    defaultFilters.set(FOM_FILTER_NAME.FOM_NUMBER, fomNumberFilter);
    defaultFilters.set(FOM_FILTER_NAME.FOREST_CLIENT_NAME, forestClientNameFilter);
    defaultFilters.set(FOM_FILTER_NAME.POSTED_ON_AFTER, postedOnAfterFilter);
    defaultFilters.set(FOM_FILTER_NAME.COMMENT_STATUS, commentStatusFilters);
    return defaultFilters;
  }

  /**
   * This reset Comment Status filter to default if both COMMENT_OPEN/COMMENT_CLOSED are false;
   * @param filters 
   */
  _resetCommentStatusFilter(filters: Map<string, IFilter | IMultiFilter>) {
    const commentStatusFilters = (filters.get(FOM_FILTER_NAME.COMMENT_STATUS) as MultiFilter<boolean>).filters as Array<IMultiFilterFields<boolean>>;
    const commentOpen = commentStatusFilters.filter(filter => filter.queryParam == COMMENT_STATUS_FILTER_PARAMS.COMMENT_OPEN)[0];
    const commentClosed = commentStatusFilters.filter(filter => filter.queryParam == COMMENT_STATUS_FILTER_PARAMS.COMMENT_CLOSED)[0];
    if (!commentOpen.value && !commentClosed.value) {
      commentOpen.value = true;
    }
  }
}

