import { Component, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

//
// component to navigate to new application route
// see app-routing.module.ts
//

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  standalone: true,
  selector: 'applications-proxy-component',
  template: ''
})
export class ApplicationsProxyComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  constructor() {
    this.router.navigate(['/applications'], {
      queryParams: { id: this.route.snapshot.params['id'] },
      fragment: 'details'
    });
  }
}
