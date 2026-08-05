import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';

export const AppRoutes: Routes = [
  {
    // Legacy landing route. Redirects to /projects, carrying the '#splash' fragment when requested so the
    // splash modal opens. A functional redirectTo can carry the fragment — replacing the former empty HomeProxyComponent.
    path: 'home/:showSplashModal',
    redirectTo: (route) => {
      const showSplash = route.params['showSplashModal'] === 'true';
      return inject(Router).createUrlTree(['/projects'], showSplash ? { fragment: 'splash' } : {});
    }
  },
  {
    path: 'about',
    loadComponent: () => import('./about/about.component').then(m => m.AboutComponent)
  },
  {
    path: 'contact',
    loadComponent: () => import('./contact/contact.component').then(m => m.ContactComponent)
  },
  {
    path: 'projects',
    loadComponent: () => import('./applications/projects.component').then(m => m.ProjectsComponent)
  },
  {
    // Legacy deep link (e.g. /a/<id>/application) → the projects view with the details panel open for <id>.
    // Replaces the former empty ApplicationsProxyComponent.
    path: 'a/:id/:tab',
    redirectTo: (route) => inject(Router).createUrlTree(['/projects'], {
      queryParams: { id: route.params['id'] },
      fragment: 'details'
    })
  },
  {
    // default route
    path: '',
    redirectTo: 'home/true',
    pathMatch: 'full'
  },
  {
    // wildcard route
    path: '**',
    redirectTo: '/home/true'
  }
];
