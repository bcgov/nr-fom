import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import { ModalService } from '@admin-core/services/modal.service';
import { StateService } from '@admin-core/services/state.service';

@Injectable({
  providedIn: 'root',
})
export class ErrorInterceptor implements HttpInterceptor {
  constructor(
    private modalSvc: ModalService,
    private stateSvc: StateService
  ) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle( request ).pipe(
      tap( () => this.stateSvc.loading = true ),
      finalize(() => this.stateSvc.loading = false),
      catchError((err) => {

        const error = err?.error?.message || err.statusText;
        const statusCode = err?.status;
        if (statusCode == 400) { // Bad Request
          this.modalSvc.openErrorDialog(`The request was not valid: ${error} <br/>Please fix the issue and try again.`, 'Bad Request');
        } else if (statusCode == 403) { // Forbidden
          this.modalSvc.openErrorDialog(`You were not authorized to perform the request. Please try again. <br/>If this issue persists, try logging out and back in. If this still persists, please contact the service desk.`, 'Forbidden');
        } else if (statusCode == 422) {
          this.modalSvc.openErrorDialog(` ${error}`, 'Save Conflict');
        } else if (statusCode == 500) { // System Error
          console.error(`${request.urlWithParams} failed with error: ` + JSON.stringify(err));
          this.modalSvc.openErrorDialog(`A system error occurred. Please try again later. If the issue persists please contact the service desk.`, 'System Error');
        } else {
          console.error(`${request.urlWithParams} failed with error: ` + JSON.stringify(err));
          this.modalSvc.openErrorDialog(`The request failed to process due to an unknown error. Please try again later. If the issue persists please contact the service desk.`);
        }
        return throwError(error);
      })
    );
  }
}
