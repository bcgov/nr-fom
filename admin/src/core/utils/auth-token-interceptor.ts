import { KeycloakService } from "@admin-core/services/keycloak.service";
import { HttpInterceptorFn, HttpRequest } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { KeycloakConfig } from "@api-client";
import { from, Observable, Subject, throwError } from "rxjs";
import { catchError, finalize, switchMap, tap } from "rxjs/operators";

/**
 * The OIDC client uses this app's HttpClient for discovery, keys and token
 * refresh. The realm must not receive the API bearer.
 */
export function isOidcProviderRequest(url: string, config: KeycloakConfig | undefined): boolean {
  if (!config?.issuerUri) {
    return false;
  }
  try {
    return new URL(url).origin === new URL(config.issuerUri).origin;
  } catch {
    return false;
  }
}

/**
 * Coordinates a single in-flight token refresh across concurrent requests.
 * A `providedIn: 'root'` service, so the state is app-wide in production while
 * TestBed recreates it per test.
 */
@Injectable({ providedIn: "root" })
export class TokenRefreshState {
  inProgress = false;
  readonly refreshed$ = new Subject<void>();
}

/**
 * Adds the bearer auth token to the request.
 */
function withAuthHeader(
  request: HttpRequest<unknown>,
  keycloakService: KeycloakService
): Observable<HttpRequest<unknown>> {
  return from(keycloakService.getBearerToken()).pipe(
    switchMap((token) => {
      if (!token) {
        return throwError(() => new Error("Auth token is missing."));
      }
      return [request.clone({ setHeaders: { Authorization: "Bearer " + token } })];
    })
  );
}

/**
 * Attempts to refresh the auth token, de-duplicating concurrent refreshes.
 */
function refreshToken(
  keycloakService: KeycloakService,
  state: TokenRefreshState
): Observable<void> {
  if (state.inProgress) {
    return new Observable((observer) => {
      state.refreshed$.subscribe(() => {
        observer.next(undefined);
        observer.complete();
      });
    });
  } else {
    state.inProgress = true;
    return keycloakService.updateToken().pipe(
      tap(() => state.refreshed$.next()),
      // Reset on failure too, or every later 403 waits forever on refreshed$.
      finalize(() => {
        state.inProgress = false;
      })
    );
  }
}

/**
 * Intercepts all http requests to automatically add the bearer auth token.
 * If the auth token expires mid-request, the request's 403 response is caught,
 * the auth token is refreshed, and the request is retried.
 */
export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const keycloakService = inject(KeycloakService);
  const state = inject(TokenRefreshState);

  if (!keycloakService.initialized || isOidcProviderRequest(request.url, keycloakService.keycloakConfig)) {
    return next(request);
  }

  return withAuthHeader(request, keycloakService).pipe(
    switchMap((authed) => next(authed).pipe(
      catchError((error) => {
        if (error.status !== 403) {
          return throwError(() => error);
        }
        console.log("Caught 403, refreshing token");
        return refreshToken(keycloakService, state).pipe(
          catchError((refreshErr) => {
            console.error(
              "Caught error during refresh, rethrowing original 403. Refresh error is",
              refreshErr
            );
            return throwError(() => error);
          }),
          switchMap(() => withAuthHeader(request, keycloakService)),
          switchMap((retry) => next(retry).pipe(
            catchError((retryErr) => {
              console.error("Caught error after retrying request, propagating error:", retryErr);
              return throwError(() => retryErr);
            })
          ))
        );
      })
    ))
  );
};
