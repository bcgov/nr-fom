import { Injectable, inject } from '@angular/core';
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

  private _loading = false;
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


  get loading() {
    return this._loading;
  }

  set loading(state: boolean) {
    this._loading = state
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
