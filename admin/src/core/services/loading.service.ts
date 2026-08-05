import { Injectable, computed, signal } from '@angular/core';

/**
 * Tracks how many HTTP requests are currently in flight and exposes a single
 * reactive `loading` signal for "is any request in flight" (global spinner /
 * form-lock). The HTTP interceptor is the only writer.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly _inFlight = signal(0);

  /** True while one or more HTTP requests are in flight. Read-only to consumers. */
  readonly loading = computed(() => this._inFlight() > 0);

  /** Called only by the HTTP interceptor when a request starts. */
  requestStarted(): void {
    this._inFlight.update((n) => n + 1);
  }

  /** Called only by the HTTP interceptor when a request settles (finalize). */
  requestFinished(): void {
    this._inFlight.update((n) => Math.max(0, n - 1));
  }
}
