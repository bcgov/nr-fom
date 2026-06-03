import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import { StateService } from '@public-core/services/state.service';
import { ModalService } from '@public-core/services/modal.service';

@Injectable({
  providedIn: 'root'
})
export class ErrorInterceptor implements HttpInterceptor {
  constructor(
    private stateSvc: StateService,
    private modalSvc: ModalService
  ) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle( request ).pipe(
      tap( () => this.stateSvc.loading = true ),
      finalize(() => this.stateSvc.loading = false),
      catchError((err) => {

        const error = err?.error?.message || err.statusText;
        console.error({
          lvl: 'ERROR',
          mssg: `${request.urlWithParams} failed with error: ${error}`,
        });

        this.modalSvc.openDialog({
          disableClose: true,
          autoFocus: true,
          data: {
            message: `The request failed to process due to an error. Please try again later.`,
            title: `Error`,
            buttons: { cancel: { text: 'OK' } },
          }
        });

        return throwError(() => err);
      })
    );
  }
}
