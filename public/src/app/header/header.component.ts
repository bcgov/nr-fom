import { animate, state, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';
import { ConfigService } from '@utility/services/config.service';

@Component({
  standalone: true,
  selector: 'app-header',
  imports: [CommonModule, RouterLink],
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
  environmentDisplay: string;
  isNavMenuOpen = false; 
  currentUrl = '';
  private destroyRef = inject(DestroyRef);

  constructor(private configService: ConfigService, public router: Router) {
    this.environmentDisplay = this.configService.getEnvironmentDisplay();
    this.currentUrl = this.router.url;
  }

  ngOnInit(): void {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => this.router.url),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((url) => {
      this.currentUrl = url;
    });
  }

  toggleNav() {
    this.isNavMenuOpen = !this.isNavMenuOpen;
  }
}