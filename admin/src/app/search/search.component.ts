import { CognitoService } from "@admin-core/services/cognito.service";
import { ModalService } from '@admin-core/services/modal.service';
import { StateService } from '@admin-core/services/state.service';
import { DatePipe, Location, NgFor, NgIf, TitleCasePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, ParamMap, Params, Router, RouterLink } from '@angular/router';
import { ProjectPlanCodeEnum, ProjectResponse, ProjectService, WorkflowStateEnum } from "@api-client";
import { NgbDropdown, NgbDropdownMenu, NgbDropdownToggle } from '@ng-bootstrap/ng-bootstrap';
import { RxReactiveFormsModule } from '@rxweb/reactive-form-validators';
import { User } from "@utility/security/user";
import { isNullish } from 'remeda';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
    standalone: true,
    imports: [
        FormsModule, 
        RxReactiveFormsModule, 
        NgFor, 
        NgIf, 
        NgbDropdown, 
        NgbDropdownToggle, 
        NgbDropdownMenu, 
        RouterLink, 
        TitleCasePipe, 
        DatePipe
    ],
    selector: 'app-search',
    templateUrl: './search.component.html',
    styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit, OnDestroy {
  readonly projectPlanCodeEnum = ProjectPlanCodeEnum;
  private ngUnsubscribe = new Subject<void>();
  private paramMap: ParamMap = null;
  private snackBarRef: MatSnackBarRef<SimpleSnackBar> = null;
  public user: User;
  public fNumber: number; // filter: FOM Number
  public fFspId: number; // filter: FSP ID
  public fStatus: string; // filter: workflowStateCode
  public fDistrict: number; // filter: district id
  public fHolder: string; // filter: part of FOM holder name
  public projects: ProjectResponse[] = [];
  public count = 0;
  public searching = false;
  public statusCodes = this.stateSvc.getCodeTable('workflowResponseCode');
  public districts = this.stateSvc.getCodeTable('district');
  public searched = false;

  constructor(
    private location: Location,
    private router: Router,
    private route: ActivatedRoute,
    private stateSvc: StateService,
    private cognitoService: CognitoService,
    public snackBar: MatSnackBar,
    public searchProjectService: ProjectService,
    private modalSvc: ModalService,
    private cd: ChangeDetectorRef
  ) {
    this.user = this.cognitoService.getUser();
  }

  ngOnInit() {
    // get search terms from route
    this.route.queryParamMap.pipe(takeUntil(this.ngUnsubscribe)).subscribe(paramMap => {
      this.paramMap = paramMap;
      this.setInitialQueryParameters();

      if (this.fFspId || this.fStatus || this.fDistrict || this.fHolder) {
        this.doSearch();
      }
    });
  }

  private doSearch() {
    this.searching = true;
    this.projects = [];
    this.count = 0;

    const workFlowStateCodeArg = this.fStatus === 'undefined'? null: this.fStatus;
    const districtArg = (isNaN(this.fDistrict) || isNullish(this.fDistrict))? null : this.fDistrict.toString();
    const fspIdArg = (isNaN(this.fFspId) || isNullish(this.fFspId))? null : this.fFspId.toString();
    const projectIdArg = (isNaN(this.fNumber) || isNullish(this.fNumber))? null : this.fNumber.toString();
    this.searchProjectService.projectControllerFind(projectIdArg, fspIdArg , districtArg, workFlowStateCodeArg, this.fHolder)
      .subscribe(
        projects => {
          this.projects = projects;
          this.count = this.projects.length;
          const limit = 2500;
          if (this.count >= limit) {
            this.modalSvc.openSnackBar({message: `Warning: Maximum of ${limit} search results exceeded -
            not all results have been displayed. Please refine your search criteria.`, button: 'OK'});
          }
          this.cd.detectChanges();
        },
        error => {
          console.error('SearchComponent.doSearch() - error =', error);
          this.searched = true;
          this.searching = false;
          this.snackBarRef = this.snackBar.open('Error searching foms ...', null, {duration: 3000});
          this.cd.detectChanges();
        },
        () => {
          this.searched = true;
          this.searching = false;
          this.cd.detectChanges();
        });
  }

  public setInitialQueryParameters() {
    this.fFspId = this.paramMap.get('fFspId')? parseInt(this.paramMap.get('fFspId')): null;
    this.fDistrict = this.paramMap.get('fDistrict')? parseInt(this.paramMap.get('fDistrict')): null;
    this.fStatus = this.paramMap.get('fStatus') || undefined;
    this.fHolder = this.paramMap.get('fHolder') || null;
  }

  public saveQueryParameters() {
    const params: Params = {};

    if (!isNaN(this.fFspId)) {
      params['fFspId'] = this.fFspId;
    }
    if (!isNaN(this.fDistrict)) {
      params['fDistrict'] = this.fDistrict;
    }
    if (this.fStatus !== 'undefined') {
      params['fStatus'] = this.fStatus;
    }
    if (this.fHolder != null) {
      params['fHolder'] = this.fHolder;
    }
    if (this.fNumber != null) {
        params['fNumber'] = this.fNumber;
    }

    // change browser URL without reloading page (so any query params are saved in history)
    this.location.go(this.router.createUrlTree([], {relativeTo: this.route, queryParams: params}).toString());
  }

  public onSubmit() {
    if (this.snackBarRef) {
      this.snackBarRef.dismiss();
    }
    this.saveQueryParameters();
    this.doSearch();
  }

  public clearQueryParameters(): void {
    this.fFspId = null;
    this.fDistrict = null;
    this.fStatus = undefined;
    this.fHolder = null;
    this.fNumber = null;
    this.saveQueryParameters();
    this.projects = [];
    this.count = 0;
    this.searched = false;
  }

  public canAccessComments(project: ProjectResponse): boolean {
    const userCanView = this.user.isMinistry || this.user.isAuthorizedForClientId(project.forestClient.id);
    return userCanView && (project.workflowState['code'] !== 'INITIAL'
                          && project.workflowState['code'] !== 'PUBLISHED');
  }

  public canEditFOM(project: ProjectResponse): boolean {
    const userCanEdit = this.user.isAuthorizedForClientId(project.forestClient.id);
    return userCanEdit && (project.workflowState.code !== WorkflowStateEnum.Published
      && project.workflowState.code !== WorkflowStateEnum.Finalized
      && project.workflowState.code !== WorkflowStateEnum.Expired);
  }

  public canViewSubmission(project: ProjectResponse): boolean {
    const userCanView = this.user.isAuthorizedForClientId(project.forestClient.id);
    return userCanView && (project.workflowState.code === WorkflowStateEnum.Initial
      || project.workflowState.code === WorkflowStateEnum.CommentClosed);
  }

  public getProjectPlanNumber(project) {
    // There are only two projectPlanCode for now.
    return project.projectPlanCode == this.projectPlanCodeEnum.Fsp? 
      "FSP #" + project.fspId : 
      "WL #" + project.woodlotLicenseNumber
  }

  ngOnDestroy() {
    if (this.snackBarRef) {
      this.snackBarRef.dismiss();
    }

    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}