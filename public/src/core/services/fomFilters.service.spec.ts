import { TestBed } from '@angular/core/testing';
import { FOMFiltersService, FOM_FILTER_NAME } from './fomFilters.service';
import { Filter, IFilter, IMultiFilter } from '../../app/applications/utils/filter';

describe('FOMFiltersService', () => {
  let service: FOMFiltersService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [FOMFiltersService] });
    service = TestBed.inject(FOMFiltersService);
  });

  function latest(): Map<string, IFilter | IMultiFilter> {
    let value: Map<string, IFilter | IMultiFilter>;
    service.filters$.subscribe((m) => (value = m)).unsubscribe();
    return value;
  }

  it('emits default filters on subscribe', () => {
    expect(latest().has(FOM_FILTER_NAME.FOM_NUMBER)).toBe(true);
    expect(latest().has(FOM_FILTER_NAME.COMMENT_STATUS)).toBe(true);
  });

  // Regression: the Find panel passes the SAME Map instance it already holds back into
  // updateFiltersSelection after mutating a filter value. The service must re-emit a *distinct*
  // reference, otherwise reference-based consumers (projects.component's rxResource keyed on
  // toSignal(filters$)) swallow the emission and the search never runs.
  it('re-emits a distinct Map even when handed back the current filters', () => {
    const current = latest(); // the map a consumer currently holds
    // mutate a value in place, exactly like the Find panel does
    (current.get(FOM_FILTER_NAME.FOM_NUMBER) as Filter<number>).filter.value = 123;

    service.updateFiltersSelection(current);

    const emitted = latest();
    expect(emitted).not.toBe(current); // distinct reference -> consumers detect the change
    // ...and the updated value is preserved
    expect((emitted.get(FOM_FILTER_NAME.FOM_NUMBER) as Filter<number>).filter.value).toBe(123);
  });

  it('emits a distinct default Map on clearFilters', () => {
    const before = latest();
    service.clearFilters();
    expect(latest()).not.toBe(before);
  });
});
