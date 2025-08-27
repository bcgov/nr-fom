import { Routes } from '@angular/router';
import { analyticsResolver } from './analytics-dashboard/analytics.resolver';

import { AboutComponent } from 'app/about/about.component';
import { AnalyticsDashboardComponent } from 'app/analytics-dashboard/analytics-dashboard.component';
import { FomAddEditComponent } from 'app/foms/fom-add-edit/fom-add-edit.component';
import { FomDetailComponent } from 'app/foms/fom-detail/fom-detail.component';
import { FomSubmissionComponent } from 'app/foms/fom-submission/fom-submission.component';
import { projectDetailResolver, projectMetricsDetailResolver, projectSpatialDetailResolver } from 'app/foms/fom.resolvers';
import { InteractionsComponent } from 'app/foms/interactions/interactions.component';
import { PublicNoticeEditComponent } from 'app/foms/public-notice/public-notice-edit.component';
import { ReviewCommentsComponent } from 'app/foms/review-comments/review-comments.component';
import { SummaryComponent } from 'app/foms/summary/summary.component';
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
    component: AboutComponent
  },
  // Note! From previous fom-routing.modules.ts
  // Probably can be improved with lazy loaded routing.
  {
    path: 'a/create',
    component: FomAddEditComponent
  },
  {
    path: 'a/:appId',
    component: FomDetailComponent,
    resolve: {
      projectDetail: projectDetailResolver,
      spatialDetail: projectSpatialDetailResolver,
      projectMetrics: projectMetricsDetailResolver
    }
  },
  {
    path: 'a/:appId/edit',
    component: FomAddEditComponent
  },
  {
    path: 'comments/:appId',
    component: ReviewCommentsComponent
  },
  {
    path: 'interactions/:appId',
    component: InteractionsComponent,
    resolve: {
      project: projectDetailResolver
    }
  },
  {
    path: 'a/:appId/upload',
    component: FomSubmissionComponent
  },
  {
    path: 'a/:appId/summary',
    component: SummaryComponent
  },
  {
    path: 'publicNotice/:appId',
    component: PublicNoticeEditComponent,
    resolve: {
      projectDetail: projectDetailResolver
    }
  },
  {
    path: 'publicNotice/:appId/edit',
    component: PublicNoticeEditComponent,
    resolve: {
      projectDetail: projectDetailResolver
    }
  },
  {
    path: 'analytics-dashboard',
    component: AnalyticsDashboardComponent,
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