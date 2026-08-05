import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ConfigService } from '@utility/services/config.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  private configService = inject(ConfigService);
  router = inject(Router);

  environmentDisplay: string | undefined;
  isNavMenuOpen = false; 

  constructor() {
    this.environmentDisplay = this.configService.getEnvironmentDisplay();
  }

  toggleNav() {
    this.isNavMenuOpen = !this.isNavMenuOpen;
  }

  /**
   * "All FOMs": return to the projects view and restore the map to its initial (all-BC) view.
   * `onSameUrlNavigation: 'reload'` + the `resetMap` navigation state make this work even when already
   * on /projects.
   */
  showAllFoms() {
    this.router.navigate(['/projects'], { onSameUrlNavigation: 'reload', state: { resetMap: true } });
  }

  /**
   * Brand logo "home": show the splash and restore the map to its initial view. Same reset
   * mechanism as {@link showAllFoms}, plus the 'splash' fragment that ProjectsComponent opens on.
   */
  showHome() {
    this.router.navigate(['/projects'], { fragment: 'splash', onSameUrlNavigation: 'reload', state: { resetMap: true } });
  }
}