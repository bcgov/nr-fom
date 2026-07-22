import { Routes } from '@angular/router';
import { analyticsResolver } from './analytics-dashboard/analytics.resolver';

import { adminGuard } from '@admin-core/guards/admin.guard';

import { projectDetailResolver, projectMetricsDetailResolver, projectSpatialDetailResolver } from 'app/foms/fom.resolvers';
import { NotAuthorizedComponent } from './not-authorized/not-authorized.component';
import { SearchComponent } from './search/search.component';

export const AppRoutes: Routes = [
  {
    path: 'not-authorized',
    component: NotAuthorizedComponent
  },
  {
    // default route
    path: 'admin',
    component: SearchComponent
  },
  {
    path: 'search',
    component: SearchComponent
  },
  {
    path: 'about',
    loadComponent: () => import('./about/about.component').then(m => m.AboutComponent)
  },
  // Note! From previous fom-routing.modules.ts
  {
    path: 'a/create',
    loadComponent: () => import('./foms/fom-add-edit/fom-add-edit.component').then(m => m.FomAddEditComponent)
  },
  {
    path: 'a/:appId',
    loadComponent: () => import('./foms/fom-detail/fom-detail.component').then(m => m.FomDetailComponent),
    resolve: {
      projectDetail: projectDetailResolver,
      spatialDetail: projectSpatialDetailResolver,
      projectMetrics: projectMetricsDetailResolver
    }
  },
  {
    path: 'a/:appId/edit',
    loadComponent: () => import('./foms/fom-add-edit/fom-add-edit.component').then(m => m.FomAddEditComponent)
  },
  {
    path: 'comments/:appId',
    loadComponent: () => import('./foms/review-comments/review-comments.component').then(m => m.ReviewCommentsComponent)
  },
  {
    path: 'interactions/:appId',
    loadComponent: () => import('./foms/interactions/interactions.component').then(m => m.InteractionsComponent),
    resolve: {
      project: projectDetailResolver
    }
  },
  {
    path: 'a/:appId/upload',
    loadComponent: () => import('./foms/fom-submission/fom-submission.component').then(m => m.FomSubmissionComponent)
  },
  {
    path: 'a/:appId/summary',
    loadComponent: () => import('./foms/summary/summary.component').then(m => m.SummaryComponent)
  },
  {
    path: 'publicNotice/:appId',
    loadComponent: () => import('./foms/public-notice/public-notice-edit.component').then(m => m.PublicNoticeEditComponent),
    resolve: {
      projectDetail: projectDetailResolver
    },
    data: { editMode: false }
  },
  {
    path: 'publicNotice/:appId/edit',
    loadComponent: () => import('./foms/public-notice/public-notice-edit.component').then(m => m.PublicNoticeEditComponent),
    resolve: {
      projectDetail: projectDetailResolver
    },
    data: { editMode: true }
  },
  {
    path: 'analytics-dashboard',
    loadComponent: () => import('./analytics-dashboard/analytics-dashboard.component').then(m => m.AnalyticsDashboardComponent),
    canActivate: [adminGuard],
    resolve: {
      analyticsData: analyticsResolver
    }
  },

  {
    // default route
    path: '',
    component: SearchComponent
  },
  {
    // wildcard route
    path: '**',
    redirectTo: '/',
    pathMatch: 'full'
  }
];
