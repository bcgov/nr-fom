import { Injectable, computed, inject, signal } from '@angular/core';
import { DistrictService, ProjectService, PublicCommentService } from '@api-client';
import { CodeTables } from '@public-core/models/code-tables';
import { BehaviorSubject, forkJoin } from 'rxjs';
import { ModalService } from './modal.service';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  private publicCommentSvc = inject(PublicCommentService);
  private districtSvc = inject(DistrictService);
  private projectSvc = inject(ProjectService);
  private modalSvc = inject(ModalService);

  private readonly _inFlight = signal(0);
  readonly loading = computed(() => this._inFlight() > 0);
  private _isReadySub = new BehaviorSubject(false);
  private _codeTables: CodeTables;
  setReady() {
    this._isReadySub.next(true);
  }
  isReady$ = this._isReadySub.asObservable();


  getCodeTable<T extends keyof CodeTables>( key: T ): CodeTables[T] {
    if (!this._codeTables) {
      this.modalSvc.showFOMinitFailure();
      throw new Error('CodeTables not initialized!');
    }
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
    return forkJoin({responseCode: this.publicCommentSvc.responseCodeControllerFindAll(), 
                     district: this.districtSvc.districtControllerFindAll(), 
                     workflowStateCode: this.projectSvc.workflowStateCodeControllerFindAll() })
  }
}
