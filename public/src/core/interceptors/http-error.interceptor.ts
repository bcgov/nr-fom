import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { LoadingService } from '@public-core/services/loading.service';
import { ModalService } from '@public-core/services/modal.service';

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const loadingSvc = inject(LoadingService);
  const modalSvc = inject(ModalService);

  loadingSvc.requestStarted();
  return next(request).pipe(
    finalize(() => loadingSvc.requestFinished()),
    catchError((err) => {
      const error = err?.error?.message || err.statusText;
      console.error({
        lvl: 'ERROR',
        mssg: `${request.urlWithParams} failed with error: ${error}`,
      });

      const status = err?.status;
      // Unpublished / non-public FOMs return 403 from GET /api/project/:id.
      const projectDetailForbidden =
        status === 403 && /\/api\/project\/\d+(?:\?|$)/.test(request.url);

      modalSvc.openDialog({
        disableClose: true,
        autoFocus: true,
        data: projectDetailForbidden
          ? {
              message: `This FOM isn't available.`,
              title: `FOM not available`,
              buttons: { cancel: { text: 'OK' } },
            }
          : {
              message: `The request failed to process due to an error. Please try again later.`,
              title: `Error`,
              buttons: { cancel: { text: 'OK' } },
            },
      });

      return throwError(() => err);
    })
  );
};
