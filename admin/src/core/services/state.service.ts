import { Injectable, inject } from '@angular/core';
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

  private _loadingCount = 0;
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


  get loading() {
    return this._loadingCount > 0;
  }

  set loading(state: boolean) {
    if (state) {
      this._loadingCount++;
    } else {
      this._loadingCount = Math.max(0, this._loadingCount - 1);
    }
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
