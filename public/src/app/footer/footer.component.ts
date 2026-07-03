import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  standalone: true,
  selector: 'app-footer',
  imports: [CommonModule, RouterLink],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent implements OnInit, OnDestroy {
  public isProjectsPage = false;
  private routerSubscription: Subscription;

  constructor(public router: Router) {}

  ngOnInit(): void {
    this.isProjectsPage = this.router.url.includes('projects');
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.isProjectsPage = event.urlAfterRedirects.includes('projects');
      });
  }

  ngOnDestroy(): void {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }
}
