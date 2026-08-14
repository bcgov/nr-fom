import { CognitoService } from "@admin-core/services/cognito.service";

import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { User } from "@utility/security/user";
import { ConfigService } from '@utility/services/config.service';

@Component({
    imports: [RouterLink],
    selector: 'app-header',
    templateUrl: './header.component.html',
    styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit {
  private configService = inject(ConfigService);
  router = inject(Router);
  private cognitoService = inject(CognitoService);

  isNavMenuOpen = false;
  environmentDisplay: string | undefined;
  user: User | null;

  constructor() {
    const configService = this.configService;

    this.environmentDisplay = configService.getEnvironmentDisplay();
    this.user = this.cognitoService.getUser();
  }

  isAdminRoleOnly(): boolean {
    return !!this.user && this.user.isAdmin && !this.user.isMinistry && !this.user.isForestClient;
  }

  ngOnInit() {
    // user is not authorized.
    if (!this.user || !this.user.isAuthorizedForAdminSite()) {
      // If on not-authorized page, or if just logged out, don't redirect to not-authorized page as would cause an infinite loop.
      // Matched on pathname so a stray query string cannot defeat the check.
      if (window.location.pathname.indexOf('/not-authorized') == -1 && !this.cognitoService.loggedOut) {
        this.router.navigate(['/not-authorized']);
      }
    }

    // user has admin role only
    if (this.user && this.isAdminRoleOnly()) {
      this.router.navigate(['/analytics-dashboard']);
      return;
    } 

  }

  async navigateToLogout() {
    // Optional chaining matters: on the logout landing, init() early-returns and
    // awsCognitoConfig is left undefined.
    if (!this.cognitoService.awsCognitoConfig?.enabled) {
        // Security disabled (local dev). Kept a full-page navigation so
        // CognitoService.init() re-runs and picks up the logged-out landing.
        window.location.href = window.location.origin + '/admin/logout';
        return;
    }
    await this.cognitoService.logout();
  }

  toggleNav() {
    this.isNavMenuOpen = !this.isNavMenuOpen;
  }

}