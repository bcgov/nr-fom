import { CognitoService } from "@admin-core/services/cognito.service";
import { HttpInterceptorFn, HttpRequest } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { Observable, Subject, throwError } from "rxjs";
import { catchError, switchMap, tap } from "rxjs/operators";

/**
 * Coordinates a single in-flight token refresh across concurrent requests.
 *
 * The previous `CognitoTokenInterceptor` class held this state as instance
 * fields; because Angular instantiates interceptors as singletons, that state
 * was effectively app-wide. Modelling it as a `providedIn: 'root'` service
 * preserves that singleton behaviour in production while keeping the functional
 * interceptor pure — and TestBed recreates the service per test, so unit tests
 * stay isolated exactly as they were with per-instance fields.
 */
@Injectable({ providedIn: "root" })
export class TokenRefreshState {
  inProgress = false;
  readonly refreshed$ = new Subject<void>();
}

/**
 * Fetches and adds the bearer auth token to the request.
 */
function addAuthHeader(
  request: HttpRequest<unknown>,
  cognitoService: CognitoService
): HttpRequest<unknown> {
  let authToken: any = cognitoService.getToken();

  if (cognitoService.awsCognitoConfig.enabled) {
    authToken = JSON.stringify(authToken['jwtToken']);
  }

  return request.clone({
    setHeaders: { Authorization: "Bearer " + authToken },
  });
}

/**
 * Attempts to refresh the auth token, de-duplicating concurrent refreshes.
 */
function refreshToken(
  cognitoService: CognitoService,
  state: TokenRefreshState
): Observable<any> {
  if (state.inProgress) {
    return new Observable((observer) => {
      state.refreshed$.subscribe(() => {
        observer.next(undefined);
        observer.complete();
      });
    });
  } else {
    state.inProgress = true;
    return cognitoService.updateToken().pipe(
      tap(() => {
        state.inProgress = false;
        state.refreshed$.next();
      })
    );
  }
}

/**
 * Intercepts all http requests to automatically add the bearer auth token.
 * If the auth token expires mid-request, the request's 403 response is caught,
 * the auth token is refreshed, and the request is retried.
 */
export const cognitoTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const cognitoService = inject(CognitoService);
  const state = inject(TokenRefreshState);

  if (!cognitoService.initialized) {
    return next(request);
  }

  request = addAuthHeader(request, cognitoService);

  return next(request).pipe(
    catchError((error) => {
      if (error.status === 403) {
        console.log("Caught 403, refreshing token");
        return refreshToken(cognitoService, state).pipe(
          catchError((refreshErr) => {
            console.error(
              "Caught error during refresh, rethrowing original 403. Refresh error is",
              refreshErr
            );
            return throwError(() => error);
          }),
          switchMap(() => {
            request = addAuthHeader(request, cognitoService);
            return next(request).pipe(
              catchError((retryErr) => {
                console.error(
                  "Caught error after retrying request, propagating error:",
                  retryErr
                );
                return throwError(() => retryErr);
              })
            );
          })
        );
      }
      return throwError(() => error);
    })
  );
};
