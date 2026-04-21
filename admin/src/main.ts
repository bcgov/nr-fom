import { APP_INITIALIZER, enableProdMode, importProvidersFrom } from '@angular/core';

import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { BrowserAnimationsModule, provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { ApiModule, Configuration } from '@api-client';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { RxReactiveFormsModule } from '@rxweb/reactive-form-validators';
import { retrieveApiBasePath } from '@utility/services/config.service';
import { AppRoutes } from 'app/app.routes';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { AppComponent } from './app/app.component';
import { ErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { CognitoService } from './core/services/cognito.service';
import { CognitoTokenInterceptor } from './core/utils/cognito-token-interceptor';
import { environment } from './environments/environment';

if (environment.production) {
    enableProdMode();
}

function cognitoFactory(cognitoService: CognitoService) {
  return () => cognitoService.init();
}

const apiConfig = new Configuration({
  basePath: retrieveApiBasePath()
})

const routesProviders = [
    provideRouter(AppRoutes)
]

const coreProviders = [
    // Note! - Prefer `withInterceptors` and functional interceptors instead, as support for DI-provided
    // interceptors may be phased out in a later release.
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimations(),
    importProvidersFrom(
        BrowserModule, 
        FormsModule, 
        ReactiveFormsModule,
        BrowserAnimationsModule,
        BsDatepickerModule,
        NgbModule, 
        ApiModule.forRoot(() => apiConfig),
        RxReactiveFormsModule,
        MatDialogModule,
        MatSnackBarModule
    ),
    {
        provide: APP_INITIALIZER,
        useFactory: cognitoFactory,
        deps: [CognitoService],
        multi: true,
    },
    // Order of these interceptors is critical - token interceptor must be last, after error interceptor.
    {
        provide: HTTP_INTERCEPTORS,
        useClass: ErrorInterceptor,
        multi: true
    },
    {
        provide: HTTP_INTERCEPTORS,
        useClass: CognitoTokenInterceptor,
        multi: true,
    },
]

bootstrapApplication(AppComponent, {
    providers: [
        ...coreProviders,
        ...routesProviders
    ]
})
.catch((err) => console.error(err));