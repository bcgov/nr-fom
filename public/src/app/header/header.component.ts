import { animate, state, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { distinctUntilChanged, filter } from 'rxjs/operators';
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

  constructor(private configService: ConfigService, public router: Router) {
    this.environmentDisplay = this.configService.getEnvironmentDisplay();
    this.currentUrl = this.router.url;
  }

  ngOnInit(): void {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      distinctUntilChanged()
    ).subscribe(() => {
      this.currentUrl = this.router.url;
    });
  }

  toggleNav() {
    this.isNavMenuOpen = !this.isNavMenuOpen;
  }
}