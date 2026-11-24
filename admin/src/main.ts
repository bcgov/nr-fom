import { importProvidersFrom, inject, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';

import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { bootstrapApplication } from '@angular/platform-browser';
import { PreloadAllModules, provideRouter, withComponentInputBinding, withInMemoryScrolling, withPreloading } from '@angular/router';
import { Configuration } from '@api-client';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { provideIsoDateAdapter } from '@utility/dates/iso-date.adapter';
import { retrieveApiBasePath } from '@utility/services/config.service';
import { AbstractSecurityStorage, DefaultLocalStorageService, provideAuth, StsConfigLoader } from 'angular-auth-oidc-client';
import { AppRoutes } from 'app/app.routes';
import { AppComponent } from './app/app.component';
import { errorInterceptor } from './core/interceptors/http-error.interceptor';
import { KeycloakService, StagedOidcConfigLoader } from './core/services/keycloak.service';
import { authTokenInterceptor } from './core/utils/auth-token-interceptor';

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
    provideZonelessChangeDetection(),
    // Order is critical - the token interceptor must run after the error interceptor
    // (it is last in the array, so it sees the response first and can refresh+retry a
    // 403 before the error interceptor would surface a "Forbidden" dialog).
    provideHttpClient(withInterceptors([errorInterceptor, authTokenInterceptor])),
    // Generated API client config — functional provider replacing ApiModule.forRoot()
    { provide: Configuration, useValue: apiConfig },
    importProvidersFrom(
        NgbModule,
        MatDialogModule,
        MatSnackBarModule
    ),
    ...provideIsoDateAdapter(),
    provideAuth({
      loader: {
        provide: StsConfigLoader,
        useClass: StagedOidcConfigLoader,
      },
    }),
    // localStorage so a login survives a new tab. The library default is sessionStorage.
    { provide: AbstractSecurityStorage, useClass: DefaultLocalStorageService },
    provideAppInitializer(() => inject(KeycloakService).init()),
]

bootstrapApplication(AppComponent, {
    providers: [
        ...coreProviders,
        ...routesProviders
    ]
})
.catch((err) => console.error(err));
