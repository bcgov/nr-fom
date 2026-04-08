import { Filter, MultiFilter, FilterUtils } from './filter';

describe('Filter', () => {
  describe('getQueryParamsString', () => {
    it('should return query string when value is set', () => {
      const f = new Filter<string>({ filter: { queryParam: 'name', value: 'acme' } });
      expect(f.getQueryParamsString()).toBe('name=acme');
    });

    it('should return empty string when value is null', () => {
      const f = new Filter<string>({ filter: { queryParam: 'name', value: null } });
      expect(f.getQueryParamsString()).toBe('');
    });

    it('should return empty string when value is undefined', () => {
      const f = new Filter<string>({ filter: { queryParam: 'name', value: undefined } });
      expect(f.getQueryParamsString()).toBe('');
    });
  });

  describe('isFilterSet', () => {
    it('should return true when value is set', () => {
      const f = new Filter<number>({ filter: { queryParam: 'id', value: 42 } });
      expect(f.isFilterSet()).toBe(true);
    });

    it('should return false when value is null', () => {
      const f = new Filter<number>({ filter: { queryParam: 'id', value: null } });
      expect(f.isFilterSet()).toBe(false);
    });
  });

  describe('reset', () => {
    it('should set value to null', () => {
      const f = new Filter<string>({ filter: { queryParam: 'name', value: 'acme' } });
      f.reset();
      expect(f.filter.value).toBeNull();
    });
  });
});

describe('MultiFilter', () => {
  function makeMultiFilter(values: boolean[]) {
    return new MultiFilter<boolean>({
      queryParamsKey: 'status',
      filters: [
        { queryParam: 'open', displayString: 'Open', value: values[0] },
        { queryParam: 'closed', displayString: 'Closed', value: values[1] },
      ],
    });
  }

  describe('getQueryParamsArray', () => {
    it('should return params for truthy filter values only', () => {
      const mf = makeMultiFilter([true, false]);
      expect(mf.getQueryParamsArray()).toEqual(['open']);
    });

    it('should return all params when all values are truthy', () => {
      const mf = makeMultiFilter([true, true]);
      expect(mf.getQueryParamsArray()).toEqual(['open', 'closed']);
    });

    it('should return empty array when no values are truthy', () => {
      const mf = makeMultiFilter([false, false]);
      expect(mf.getQueryParamsArray()).toEqual([]);
    });
  });

  describe('getQueryParamsString', () => {
    it('should join selected params with pipe delimiter', () => {
      const mf = makeMultiFilter([true, true]);
      expect(mf.getQueryParamsString()).toBe('open|closed');
    });

    it('should return single param without delimiter', () => {
      const mf = makeMultiFilter([true, false]);
      expect(mf.getQueryParamsString()).toBe('open');
    });

    it('should return empty string when no filters are set', () => {
      const mf = makeMultiFilter([false, false]);
      expect(mf.getQueryParamsString()).toBe('');
    });
  });

  describe('isFilterSet', () => {
    it('should return true when at least one value is truthy', () => {
      const mf = makeMultiFilter([false, true]);
      expect(mf.isFilterSet()).toBe(true);
    });

    it('should return false when all values are falsy', () => {
      const mf = makeMultiFilter([false, false]);
      expect(mf.isFilterSet()).toBe(false);
    });
  });

  describe('reset', () => {
    it('should set all filter values to null', () => {
      const mf = makeMultiFilter([true, true]);
      mf.reset();
      mf.filters.forEach(f => expect(f.value).toBeNull());
    });
  });
});

describe('FilterUtils', () => {
  describe('hashFilters', () => {
    it('should return a non-empty string', () => {
      const f = new Filter<string>({ filter: { queryParam: 'name', value: 'acme' } });
      expect(typeof FilterUtils.hashFilters(f)).toBe('string');
      expect(FilterUtils.hashFilters(f).length).toBeGreaterThan(0);
    });

    it('should return the same hash for identical filter states', () => {
      const a = new Filter<string>({ filter: { queryParam: 'name', value: 'acme' } });
      const b = new Filter<string>({ filter: { queryParam: 'name', value: 'acme' } });
      expect(FilterUtils.hashFilters(a)).toBe(FilterUtils.hashFilters(b));
    });

    it('should return different hashes for different filter states', () => {
      const a = new Filter<string>({ filter: { queryParam: 'name', value: 'acme' } });
      const b = new Filter<string>({ filter: { queryParam: 'name', value: 'other' } });
      expect(FilterUtils.hashFilters(a)).not.toBe(FilterUtils.hashFilters(b));
    });

    it('should return a hash when called with no arguments', () => {
      expect(typeof FilterUtils.hashFilters()).toBe('string');
    });
  });
});
