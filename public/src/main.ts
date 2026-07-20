import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { bootstrapApplication } from '@angular/platform-browser';
import { PreloadAllModules, provideRouter, withComponentInputBinding, withInMemoryScrolling, withPreloading } from '@angular/router';
import { ApiModule, Configuration } from '@api-client';
import { errorInterceptor } from '@public-core/interceptors/http-error.interceptor';
import { retrieveApiBasePath } from '@utility/services/config.service';
import { AppComponent } from 'app/app.component';
import { AppRoutes } from 'app/app.routes';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';

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
        MatDialogModule
    ),
]

const routesProviders = [
    provideRouter(
        AppRoutes,
        withComponentInputBinding(),
        withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
        withPreloading(PreloadAllModules)
    )
]

// Bootstrap standalone root AppComponent.
bootstrapApplication(AppComponent, {
    providers: [
        ...coreProviders,
        ...routesProviders
    ]
})
.catch((err) => console.error(err));

