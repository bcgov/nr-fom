import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { enableProdMode, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { bootstrapApplication } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { ApiModule, Configuration } from '@api-client';
import { errorInterceptor } from '@public-core/interceptors/http-error.interceptor';
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
    provideZoneChangeDetection({
        eventCoalescing: true,
    }),
    provideHttpClient(withInterceptors([errorInterceptor])),
    importProvidersFrom(
        ApiModule.forRoot(() => apiConfig),
        BsDatepickerModule,
        BrowserAnimationsModule,
        MatDialogModule
    ),
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
.catch((err) => console.error(err));

