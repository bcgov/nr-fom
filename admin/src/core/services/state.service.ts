import { Injectable, computed, inject, signal } from '@angular/core';
import { DistrictService, PublicCommentService, ProjectService } from '@api-client';
import { CodeTables } from '@admin-core/models/code-tables';
import { BehaviorSubject, forkJoin } from 'rxjs';

// Eagerly loads and caches all code table values.
@Injectable({
  providedIn: 'root'
})
export class StateService {
  private publicCommentSvc = inject(PublicCommentService);
  private districtSvc = inject(DistrictService);
  private projectSvc = inject(ProjectService);

  private readonly _inFlight = signal(0);
  readonly loading = computed(() => this._inFlight() > 0);
  private _isReadySub = new BehaviorSubject(false);
  private _codeTables: CodeTables = {
    responseCode: [],
    district: [],
    workflowResponseCode: [],
    commentScopeCode: []
  };
  setReady() {
    this._isReadySub.next(true);
  }
  isReady$ = this._isReadySub.asObservable();


  getCodeTable<T extends keyof CodeTables>( key: T ): CodeTables[T] {
    return this._codeTables[key];
  }


  /** Called only by the HTTP interceptor when a request starts. */
  requestStarted(): void {
    this._inFlight.update((n) => n + 1);
  }

  /** Called only by the HTTP interceptor when a request settles (finalize). */
  requestFinished(): void {
    this._inFlight.update((n) => Math.max(0, n - 1));
  }

  setCodeTables(codeTables: CodeTables) {
    this._codeTables = codeTables

  }

  get codeTables() {
    return this._codeTables;
  }

  getCodeTables() {
    return forkJoin({
        responseCode: this.publicCommentSvc.responseCodeControllerFindAll(),
        district: this.districtSvc.districtControllerFindAll(),
        workflowResponseCode: this.projectSvc.workflowStateCodeControllerFindAll(),
        commentScopeCode: this.publicCommentSvc.commentScopeCodeControllerFindAll(),
      })
  }
}
