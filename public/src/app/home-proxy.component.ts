import { Component } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

//
// component to (re)load applications component optionally with Splash modal
// see app-routing.module.ts
//

@Component({
   
  standalone: true,
  selector: 'home-proxy-component',
  template: ''
})
export class HomeProxyComponent {
  constructor(private router: Router, private route: ActivatedRoute) {
    const showSplashModal = this.route.snapshot.paramMap.get('showSplashModal');
    if (showSplashModal === 'true') {
      this.router.navigate(['/projects'], {fragment: 'splash' });
    } else {
      this.router.navigate(['/projects']);
    }
  }
}
