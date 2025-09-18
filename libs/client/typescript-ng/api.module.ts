import { NgModule, ModuleWithProviders, SkipSelf, Optional } from '@angular/core';
import { Configuration } from './configuration';
import { HttpClient } from '@angular/common/http';

import { AnalyticsDashboardService } from './api/analyticsDashboard.service';
import { AttachmentService } from './api/attachment.service';
import { AuthService } from './api/auth.service';
import { DistrictService } from './api/district.service';
import { ExternalService } from './api/external.service';
import { ForestClientService } from './api/forestClient.service';
import { InteractionService } from './api/interaction.service';
import { ProjectService } from './api/project.service';
import { PublicCommentService } from './api/publicComment.service';
import { PublicNoticeService } from './api/publicNotice.service';
import { SpatialFeatureService } from './api/spatialFeature.service';
import { SubmissionService } from './api/submission.service';

@NgModule({
  imports:      [],
  declarations: [],
  exports:      [],
  providers: []
})
export class ApiModule {
    public static forRoot(configurationFactory: () => Configuration): ModuleWithProviders<ApiModule> {
        return {
            ngModule: ApiModule,
            providers: [ { provide: Configuration, useFactory: configurationFactory } ]
        };
    }

    constructor( @Optional() @SkipSelf() parentModule: ApiModule,
                 @Optional() http: HttpClient) {
        if (parentModule) {
            throw new Error('ApiModule is already loaded. Import in your base AppModule only.');
        }
        if (!http) {
            throw new Error('You need to import the HttpClientModule in your AppModule! \n' +
            'See also https://github.com/angular/angular/issues/20575');
        }
    }
}
