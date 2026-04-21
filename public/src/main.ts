import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { enableProdMode, importProvidersFrom } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { bootstrapApplication } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { ApiModule, Configuration } from '@api-client';
import { ErrorInterceptor } from '@public-core/interceptors/http-error.interceptor';
import { retrieveApiBasePath } from '@utility/services/config.service';
import { AppComponent } from 'app/app.component';
import { AppRoutes } from 'app/app.routes';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}
const apiConfig = new Configuration({
    basePath: retrieveApiBasePath()
});

const coreProviders = [
    // Note! - Prefer `withInterceptors` and functional interceptors instead, as support for DI-provided
    // interceptors may be phased out in a later release.
    provideHttpClient(withInterceptorsFromDi()),
    importProvidersFrom(
        ApiModule.forRoot(() => apiConfig),
        BsDatepickerModule,
        BrowserAnimationsModule,
        MatDialogModule
    ),
    {
        provide: HTTP_INTERCEPTORS,
        useClass: ErrorInterceptor,
        multi: true
    },
]

const routesProviders = [
    provideRouter(AppRoutes)
]

// Bootstrap standalone root AppComponent.
bootstrapApplication(AppComponent, {
    providers: [
        ...coreProviders,
        ...routesProviders
    ]
})
