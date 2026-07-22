import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { StateService } from '@public-core/services/state.service';
import { ModalService } from '@public-core/services/modal.service';

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const stateSvc = inject(StateService);
  const modalSvc = inject(ModalService);

  stateSvc.requestStarted();
  return next(request).pipe(
    finalize(() => stateSvc.requestFinished()),
    catchError((err) => {
      const error = err?.error?.message || err.statusText;
      console.error({
        lvl: 'ERROR',
        mssg: `${request.urlWithParams} failed with error: ${error}`,
      });

      modalSvc.openDialog({
        disableClose: true,
        autoFocus: true,
        data: {
          message: `The request failed to process due to an error. Please try again later.`,
          title: `Error`,
          buttons: { cancel: { text: 'OK' } },
        },
      });

      return throwError(() => err);
    })
  );
};
