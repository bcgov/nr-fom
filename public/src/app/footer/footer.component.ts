import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs/operators';

@Component({
  selector: 'app-footer',
  imports: [],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss'
})
export class FooterComponent {
  router = inject(Router);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  // Conditionally render the footer based on the current URL. 
  // The footer is hidden on the About page.
  readonly isProjectsPage = computed(() =>
    (this.currentUrl() || window.location.pathname).includes('projects')
  );

  /**
   * Footer "Home": show the splash and restore the map to its initial view.
   */
  showHome() {
    this.router.navigate(['/projects'], { fragment: 'splash', onSameUrlNavigation: 'reload', state: { resetMap: true } });
  }
}
