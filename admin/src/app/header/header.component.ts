import { CognitoService } from "@admin-core/services/cognito.service";
import { animate, state, style, transition, trigger } from '@angular/animations';
import { NgIf } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { User } from "@utility/security/user";
import { ConfigService } from '@utility/services/config.service';

@Component({
    standalone: true,
    imports: [RouterLink, NgIf],
    selector: 'app-header',
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss'],
    animations: [
        trigger('toggleNav', [
            state('navClosed', style({ height: '0' })),
            state('navOpen', style({ height: '*' })),
            transition('navOpen => navClosed', [animate('0.2s')]),
            transition('navClosed => navOpen', [animate('0.2s')])
        ])
    ]
})
export class HeaderComponent implements OnInit {
  isNavMenuOpen = false; 
  environmentDisplay: string;
  user: User;

  constructor(
    private configService: ConfigService, 
    public router: Router, 
    private cognitoService: CognitoService
  ) {
    this.environmentDisplay = configService.getEnvironmentDisplay();
    this.user = this.cognitoService.getUser();
  }

  ngOnInit() {
    // user is not authorized.
    if (!this.user 
        || (
          !this.user.isAuthorizedForAdminSite() 
          && !this.user.isAuthorizedForAdminOperation()
        )) {
      // If on not-authorized page, or if just logged out, don't redirect to not-authorized page as would cause an infinite loop.
      if (window.location.href.indexOf('/not-authorized') == -1 && window.location.href.indexOf("loggedout=true") == -1) {
        this.router.navigate(['/not-authorized']);
      }
    }

    // user is admin only
    if (this.user.isAuthorizedForAdminOperation() && !this.user.isAuthorizedForAdminSite()) {
      this.router.navigate(['/analytics-dashboard']);
    } 
  }

  async navigateToLogout() {
    if (!this.cognitoService.awsCognitoConfig.enabled) {
        window.location.href = window.location.origin + '/admin/not-authorized?loggedout=true';
        return;
    }
    await this.cognitoService.logout();
  }

  toggleNav() {
    this.isNavMenuOpen = !this.isNavMenuOpen;
  }

}