import { Routes } from '@angular/router';

import { ApplicationsProxyComponent } from './applications-proxy.component';
import { HomeProxyComponent } from './home-proxy.component';

export const AppRoutes: Routes = [
  {
    // proxy component is needed because fragment in redirectTo doesn't work in Angular v4
    path: 'home/:showSplashModal',
    component: HomeProxyComponent
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
    // redirect from legacy route to new route
    // eg, /a/5b15c2f743cf9c0019391cfc/application => /applications?id=5b15c2f743cf9c0019391cfc#details
    // proxy component is needed because query parameter and fragment in redirectTo don't work in Angular v4
    path: 'a/:id/:tab',
    component: ApplicationsProxyComponent
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
