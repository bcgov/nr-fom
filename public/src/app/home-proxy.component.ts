import { Component, OnInit, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

//
// component to (re)load applications component optionally with Splash modal
// see app-routing.module.ts
//

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'home-proxy-component',
  template: ''
})
export class HomeProxyComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);


  ngOnInit() {
    const showSplashModal = this.route.snapshot.paramMap.get('showSplashModal');
    if (showSplashModal === 'true') {
      this.router.navigate(['/projects'], {fragment: 'splash' });
    } else {
      this.router.navigate(['/projects']);
    }
  }
}
