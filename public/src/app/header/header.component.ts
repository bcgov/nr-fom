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

  environmentDisplay: string;
  isNavMenuOpen = false; 

  constructor() {
    this.environmentDisplay = this.configService.getEnvironmentDisplay();
  }

  toggleNav() {
    this.isNavMenuOpen = !this.isNavMenuOpen;
  }
}