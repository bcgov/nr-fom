import { animate, state, style, transition, trigger } from '@angular/animations';

import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ConfigService } from '@utility/services/config.service';

@Component({
  standalone: true,
  selector: 'app-header',
  imports: [RouterLink],
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
export class HeaderComponent {
  private configService = inject(ConfigService);
  router = inject(Router);

  environmentDisplay: string;
  isNavMenuOpen = false; 

  constructor() {
    this.environmentDisplay = this.configService.getEnvironmentDisplay();
  }

  toggleNav() {
    this.isNavMenuOpen = !this.isNavMenuOpen;
  }
}