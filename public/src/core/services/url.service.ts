import { Location } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { ActivatedRoute, Event, NavigationEnd, Params, Router } from '@angular/router';
import { funnel } from 'remeda';
import { Observable } from 'rxjs';
import { filter, share } from 'rxjs/operators';

/**
 * This service provides a centralized mechanism to save and restore query parameters to the URL.
 * This allows browser forward/back functionality as well as bookmarking and copy/pasting a URL.
 *
 * @export
 * @class UrlService
 */
@Injectable({
    providedIn: 'root',
})
export class UrlService {
  route = inject(ActivatedRoute);
  router = inject(Router);
  location = inject(Location);

  public onNavEnd$: Observable<NavigationEnd>; // see details below
  private queryParams: Params = {};
  private panel: string | null = null;

  constructor() {
    // Create a new observable that publishes only the NavigationEnd event used for subscribers to know when to
    // refresh their parameters
    // Use share() so this fires only once each time even with multiple subscriptions
    this.onNavEnd$ = this.router.events.pipe(
      filter((event: Event): event is NavigationEnd => event instanceof NavigationEnd),
      share()
    );

    // Initialize fragment and query params from initial URL
    const initialUrlTree = this.router.parseUrl(this.router.url);
    if (initialUrlTree) {
      this.panel = initialUrlTree.fragment;
      this.queryParams = { ...initialUrlTree.queryParams };
    }

    // keep url fragment and query params up to date on navigation end
    this.onNavEnd$.subscribe(event => {
      const urlTree = this.router.parseUrl(event.url);
      const activeUrlTree = this.router.parseUrl(this.router.url);

      if (urlTree) {
        this.panel = urlTree.fragment || activeUrlTree.fragment;
        this.queryParams = { ...urlTree.queryParams };
      }
    });
  }

  /**
   * Gets a query parameter from the url.
   *
   * @param {string} key query paramter url key
   * @returns {string} query paramter url value associated with the key or null if none found
   * @memberof UrlService
   */
  public getQueryParam(key: string): string {
    return this.queryParams[key] || null;
  }

  /**
   * Adds or removes a query paramter from the url.
   *
   * Note: If the query parameter key has already been used, and a null or undefined value is provided, the query
   * param will be removed.
   *
   * @param {string} key query paramter url key
   * @param {string} value query paramter url value
   * @memberof UrlService
   */
  public setQueryParam(key: string, value: string | null): void {
    if (value === this.getQueryParam(key)) {
      // query param exists and has not changed
      return;
    }

    if (value) {
      // add/update key
      this.queryParams[key] = value;
    } else {
      // remove key
      delete this.queryParams[key];
    }

    // update url
    this.navigate.call();
  }

  /**
   * Sets the url fragment.
   *
   * Example: www.domain.com/path/123#fragment
   *
   * @param {string} fragment url fragment
   * @memberof UrlService
   */
  public setFragment(fragment: string | null): void {
    if (fragment === this.panel) {
      // fragment exists and has not changed
      return;
    }

    this.panel = fragment;
    this.navigate.call();
  }

  /**
   * Get the current url fragment.
   *
   * @returns {string}
   * @memberof UrlService
   */
  public getFragment(): string | null {
    return this.panel;
  }

  /**
   * Update the browsers url.
   *
   * @memberof UrlService
   */
  public navigate = funnel(() => {
    this.router
      .navigate([], { relativeTo: this.route, queryParams: this.queryParams, fragment: this.panel ?? undefined })
      .toString();
  }, { minQuietPeriodMs: 100 });
}
