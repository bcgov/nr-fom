import { DELIMITER } from '@public-core/constants/appConstants';
import hash from 'object-hash';

/**
 * Basic required filter fields.
 *
 * @export
 * @interface IFilterFields
 * @template T
 */
export interface IFilterFields<T> {
  /**
   * Key used when building url query param strings.
   *
   * @type {string}
   * @memberof IFilterFields
   */
  queryParam: string;

  /**
   * Filter value.
   *
   * @type {T}
   * @memberof IFilterFields
   */
  value: T;
}

export interface IFilter {
  getQueryParamsString(): string;
  isFilterSet(): boolean;
  reset(): void;
}

/**
 * Single value filter.
 *
 * @export
 * @class Filter
 * @template T
 */
export class Filter<T> implements IFilter {
  public filter: IFilterFields<T>;

  constructor({ filter }: { filter: IFilterFields<T> }) {
    this.filter = filter;
  }

  /**
   * Returns the filter as a query string of the form `'queryParam=value'`
   * Returns empty string if the filter value is null, undefined, or empty.
   *
   * @returns {string}
   * @memberof Filter
   */
  public getQueryParamsString(): string {
    if (!this.filter.value) {
      return '';
    }

    return `${this.filter.queryParam}=${this.filter.value}`;
  }

  /**
   * Returns true if filter value is set (not null, undefined, or empty), false otherwise.
   *
   * @returns {boolean}
   * @memberof Filter
   */
  public isFilterSet(): boolean {
    return !!this.filter.value;
  }

  /**
   * Sets the filter value to null.
   *
   * @memberof Filter
   */
  public reset(): void {
    this.filter.value = null;
  }
}

/**
 * Basic required multi filter fields.
 *
 * @export
 * @interface IMultiFilterFields
 * @extends {IFilterFields<T>}
 * @template T
 */
export interface IMultiFilterFields<T> extends IFilterFields<T> {
  /**
   * Human readable display string
   *
   * @type {string}
   * @memberof IFilterFields
   */
  displayString: string;
}

export interface IMultiFilter extends IFilter {
  getQueryParamsArray(): string[];
}

/**
 * Multi value filter.
 *
 * @export
 * @class MultiFilter<boolean>
 */
export class MultiFilter<T> implements IMultiFilter {
  public queryParamsKey: string;
  public filters: Array<IMultiFilterFields<T>>;
  private readonly PARAMS_DELIMITER = DELIMITER.PIPE;

  constructor({ queryParamsKey, filters }: { queryParamsKey: string; filters: Array<IMultiFilterFields<T>> }) {
    this.queryParamsKey = queryParamsKey;
    this.filters = filters;
  }

  /**
   * Returns the non-null, non-undefined filters as an array of params.
   *
   * Example: ['bird', 'dog', 'cat']
   *
   * @returns {string[]}
   * @memberof MultiFilter<boolean>
   */
  public getQueryParamsArray(): string[] {
    return this.filters.filter(filter => filter.value).map(filter => filter.queryParam);
  }

  /**
   * Returns the non-null, non-undefined filters as a query string where each filter param is separated by
   * a pipe '|' symbol.
   *
   * Example: ['bird','dog','cat'] -> 'bird|dog|cat'
   *
   * @returns {string}
   * @memberof MultiFilter<boolean>
   */
  public getQueryParamsString(): string {
    // get all filters that have a non-null/non-undefined value
    const selectedFilters: Array<IMultiFilterFields<T>> = this.filters.filter(filter => filter.value);

    return selectedFilters.map(filter => filter.queryParam).join(this.PARAMS_DELIMITER);
  }

  /**
   * Returns true if at least one filter has been set, false otherwise.
   *
   * @returns {boolean}
   * @memberof MultiFilter<boolean>
   */
  public isFilterSet(): boolean {
    return this.filters.filter(filter => filter.value).length > 0;
  }

  /**
   * Sets all filter values to null.
   *
   * @memberof MultiFilter<boolean>
   */
  public reset(): void {
    this.filters.forEach(filter => (filter.value = null));
  }
}

export class FilterUtils {
  public static hashFilters(...filters: IFilter[]) {
    if (!filters || filters.length <= 0) {
      return hash({});
    }

    return hash(filters);
  }
}
