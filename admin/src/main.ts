import { importProvidersFrom, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';

import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { bootstrapApplication } from '@angular/platform-browser';
import { PreloadAllModules, provideRouter, withComponentInputBinding, withInMemoryScrolling, withPreloading } from '@angular/router';
import { ApiModule, Configuration } from '@api-client';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { RxReactiveFormsModule } from '@rxweb/reactive-form-validators';
import { retrieveApiBasePath } from '@utility/services/config.service';
import { AppRoutes } from 'app/app.routes';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { AppComponent } from './app/app.component';
import { errorInterceptor } from './core/interceptors/http-error.interceptor';
import { CognitoService } from './core/services/cognito.service';
import { cognitoTokenInterceptor } from './core/utils/cognito-token-interceptor';

const apiConfig = new Configuration({
  basePath: retrieveApiBasePath()
})

const routesProviders = [
    provideRouter(
        AppRoutes,
        withComponentInputBinding(),
        withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
        withPreloading(PreloadAllModules)
    )
]

const coreProviders = [
    provideZoneChangeDetection({
        eventCoalescing: true,
    }),
    // Order is critical - the token interceptor must run after the error interceptor
    // (it is last in the array, so it sees the response first and can refresh+retry a
    // 403 before the error interceptor would surface a "Forbidden" dialog).
    provideHttpClient(withInterceptors([errorInterceptor, cognitoTokenInterceptor])),
    importProvidersFrom(
        BsDatepickerModule,
        NgbModule,
        ApiModule.forRoot(() => apiConfig),
        RxReactiveFormsModule,
        MatDialogModule,
        MatSnackBarModule
    ),
    provideAppInitializer(() => inject(CognitoService).init()),
]

bootstrapApplication(AppComponent, {
    providers: [
        ...coreProviders,
        ...routesProviders
    ]
})
.catch((err) => console.error(err));
