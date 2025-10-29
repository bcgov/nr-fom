import { CognitoService } from "@admin-core/services/cognito.service";
import {
    HttpHandler,
    HttpInterceptor,
    HttpRequest,
} from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable, Subject } from "rxjs";
import { catchError, switchMap, tap } from "rxjs/operators";

/**
 * Intercepts all http requests and allows for the request and/or response to be manipulated.
 *
 * @export
 * @class CognitoTokenInterceptor
 * @implements {HttpInterceptor}
 */
@Injectable()
export class CognitoTokenInterceptor implements HttpInterceptor {
  private refreshTokenInProgress = false;

  private tokenRefreshedSource = new Subject<void>();
  private tokenRefreshed$ = this.tokenRefreshedSource.asObservable();

  constructor(private cognitoService: CognitoService) {}

  /**
   * Main request intercept handler to automatically add the bearer auth token to every request.
   * If the auth token expires mid-request, the requests 403 response will be caught, the auth token will be
   * refreshed, and the request will be re-tried.
   *
   * @param {HttpRequest<any>} request
   * @param {HttpHandler} next
   * @returns {Observable<HttpEvent<any>>}
   * @memberof CognitoTokenInterceptor
   */
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<any> {
    if (!this.cognitoService.initialized) {
      return next.handle(request);
    }

    request = this.addAuthHeader(request);

    return next.handle(request).pipe(
      catchError((error) => {
        if (error.status === 403) {
          console.log("Caught 403, refreshing token");
          return this.refreshToken().pipe(
            switchMap(() => {
              request = this.addAuthHeader(request);
              return next.handle(request);
            }),
            catchError((err) => {
              // If the user really isn't authorized, every attempt will fail even after token refresh.
              console.error(
                "Caught error after refresh, rethowing original. New error is",
                err
              );
              // Rethrow original forbidden error as throwning new err isn't working. A bit of a hack...
              throw error;
            })
          );
        }
        throw error;
      })
    );
  }

  /**
   * Fetches and adds the bearer auth token to the request.
   *
   * @private
   * @param {HttpRequest<any>} request to modify
   * @returns {HttpRequest<any>}
   * @memberof CognitoTokenInterceptor
   */
  private addAuthHeader(request: HttpRequest<any>): HttpRequest<any> {
    let authToken: any = this.cognitoService.getToken();

    if (this.cognitoService.awsCognitoConfig.enabled) {
      authToken = JSON.stringify(authToken['jwtToken']);
    }

    request = request.clone({
      setHeaders: { Authorization: "Bearer " + authToken },
    });

    return request;
  }

  /**
   * Attempts to refresh the auth token.
   *
   * @private
   * @returns {Observable<any>}
   * @memberof CognitoTokenInterceptor
   */
  private refreshToken(): Observable<any> {
    if (this.refreshTokenInProgress) {
      return new Observable((observer) => {
        this.tokenRefreshed$.subscribe(() => {
            observer.next(undefined);
          observer.complete();
        });
      });
    } else {
      this.refreshTokenInProgress = true;
      return this.cognitoService.updateToken().pipe(
        tap(() => {
          this.refreshTokenInProgress = false;
          this.tokenRefreshedSource.next();
        })
      );
    }
  }
}
