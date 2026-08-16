import { CognitoService } from '@admin-core/services/cognito.service';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { ConfigService } from '@utility/services/config.service';
import { HeaderComponent } from './header.component';

/**
 * HeaderComponent.ngOnInit is FOM's de facto authentication gate - there is no
 * canActivate for authentication anywhere in the route table - so its redirect
 * decisions are worth pinning down.
 */
describe('HeaderComponent', () => {
  let mockCognitoService: any;
  let navigate: jest.SpyInstance;

  const authorizedUser = {
    isAdmin: false,
    isMinistry: true,
    isForestClient: false,
    isAuthorizedForAdminSite: () => true
  };

  const setup = (user: any, loggedOut = false) => {
    mockCognitoService = {
      getUser: jest.fn().mockReturnValue(user),
      logout: jest.fn().mockResolvedValue(undefined),
      loggedOut,
      awsCognitoConfig: { enabled: true }
    };

    TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([]),
        { provide: CognitoService, useValue: mockCognitoService },
        { provide: ConfigService, useValue: { getEnvironmentDisplay: () => 'TEST' } }
      ]
    });

    navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    return TestBed.createComponent(HeaderComponent);
  };

  afterEach(() => {
    window.history.pushState({}, '', '/');
    jest.restoreAllMocks();
  });

  describe('the not-authorized redirect', () => {
    it('does NOT bounce off the logout landing', () => {
      // The regression this guards: every logout lands on /admin/logout with no
      // user, and without this check the header instantly redirects to
      // /admin/not-authorized, so the logout screen is never seen.
      window.history.pushState({}, '', '/admin/logout');
      const fixture = setup(null, true);

      fixture.detectChanges();

      expect(navigate).not.toHaveBeenCalled();
    });

    it('does NOT bounce off the not-authorized page itself, which would loop', () => {
      window.history.pushState({}, '', '/admin/not-authorized');
      const fixture = setup(null);

      fixture.detectChanges();

      expect(navigate).not.toHaveBeenCalled();
    });

    it('redirects an unauthenticated user on a normal page', () => {
      window.history.pushState({}, '', '/admin/search');
      const fixture = setup(null);

      fixture.detectChanges();

      expect(navigate).toHaveBeenCalledWith(['/not-authorized']);
    });

    it('redirects a signed-in but unauthorized user', () => {
      window.history.pushState({}, '', '/admin/search');
      const fixture = setup({ ...authorizedUser, isAuthorizedForAdminSite: () => false });

      fixture.detectChanges();

      expect(navigate).toHaveBeenCalledWith(['/not-authorized']);
    });

    it('leaves an authorized user alone', () => {
      window.history.pushState({}, '', '/admin/search');
      const fixture = setup(authorizedUser);

      fixture.detectChanges();

      expect(navigate).not.toHaveBeenCalled();
    });

    it('sends an admin-only user to the analytics dashboard', () => {
      window.history.pushState({}, '', '/admin/search');
      const fixture = setup({
        isAdmin: true,
        isMinistry: false,
        isForestClient: false,
        isAuthorizedForAdminSite: () => true
      });

      fixture.detectChanges();

      expect(navigate).toHaveBeenCalledWith(['/analytics-dashboard']);
    });
  });

  describe('navigateToLogout', () => {
    it('drives the federated chain when security is enabled', async () => {
      const fixture = setup(authorizedUser);

      await fixture.componentInstance.navigateToLogout();

      expect(mockCognitoService.logout).toHaveBeenCalledTimes(1);
    });

    it('goes straight to the logout landing when security is disabled (local dev)', async () => {
      const fixture = setup(authorizedUser);
      mockCognitoService.awsCognitoConfig = { enabled: false };

      await fixture.componentInstance.navigateToLogout();

      // No chain to run without Cognito; the full-page navigation to /admin/logout
      // is what re-runs CognitoService.init().
      expect(mockCognitoService.logout).not.toHaveBeenCalled();
    });

    it('does not throw when awsCognitoConfig is undefined, as on the logout landing', async () => {
      const fixture = setup(null, true);
      mockCognitoService.awsCognitoConfig = undefined;

      await expect(fixture.componentInstance.navigateToLogout()).resolves.not.toThrow();
      expect(mockCognitoService.logout).not.toHaveBeenCalled();
    });
  });
});
