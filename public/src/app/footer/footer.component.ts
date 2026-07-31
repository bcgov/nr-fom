import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-footer',
  imports: [],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss'
})
export class FooterComponent implements OnInit {
  router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  public isProjectsPage = false;
  private destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.syncProjectsPage(this.router.url);
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => {
        this.syncProjectsPage(event.urlAfterRedirects);
        // Router-driven updates (e.g. home/true → projects#splash) may not reach this view without an explicit tick.
        this.cdr.detectChanges();
      });
  }

  private syncProjectsPage(url: string): void {
    this.isProjectsPage = (url || window.location.pathname).includes('projects');
  }

  /**
   * Footer "Home": show the splash and restore the map to its initial view. 
   */
  showHome() {
    this.router.navigate(['/projects'], { fragment: 'splash', onSameUrlNavigation: 'reload', state: { resetMap: true } });
  }
}
