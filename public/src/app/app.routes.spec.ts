import { TestBed } from '@angular/core/testing';
import { Params, RedirectFunction, Router, UrlTree, provideRouter } from '@angular/router';
import { AppRoutes } from './app.routes';

/**
 * Regression coverage for the legacy functional redirects that replaced the former
 * HomeProxyComponent / ApplicationsProxyComponent. Each redirectTo runs in an injection context and
 * returns a UrlTree; we serialize it to assert the exact resulting URL.
 */
describe('AppRoutes legacy redirects', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    router = TestBed.inject(Router);
  });

  function redirect(path: string, params: Params): string {
    const fn = AppRoutes.find((r) => r.path === path)!.redirectTo as RedirectFunction;
    const tree = TestBed.runInInjectionContext(() => fn({ params } as any)) as UrlTree;
    return router.serializeUrl(tree);
  }

  it('home/:showSplashModal = "true" → /projects#splash (splash modal shown)', () => {
    expect(redirect('home/:showSplashModal', { showSplashModal: 'true' })).toBe('/projects#splash');
  });

  it('home/:showSplashModal = "false" → /projects (no splash)', () => {
    expect(redirect('home/:showSplashModal', { showSplashModal: 'false' })).toBe('/projects');
  });

  it('a/:id/:tab → /projects?id=<id>#details (tab dropped, opens the details panel)', () => {
    expect(redirect('a/:id/:tab', { id: 'abc123', tab: 'application' })).toBe('/projects?id=abc123#details');
  });
});
