import { CognitoService } from "@admin-core/services/cognito.service";
import { ModalService } from '@admin-core/services/modal.service';
import { StateService } from '@admin-core/services/state.service';
import { DatePipe, Location, TitleCasePipe } from '@angular/common';
import { Component, DestroyRef, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, ParamMap, Params, Router, RouterLink } from '@angular/router';
import { ProjectPlanCodeEnum, ProjectResponse, ProjectService, WorkflowStateEnum } from "@api-client";
import { NgbDropdown, NgbDropdownMenu, NgbDropdownToggle } from '@ng-bootstrap/ng-bootstrap';
import { RxReactiveFormsModule } from '@rxweb/reactive-form-validators';
import { User } from "@utility/security/user";
import { isNullish } from 'remeda';

// Arguments passed to projectControllerFind (all normalised to string | undefined,
// matching the generated client's optional parameters).
interface FindArgs {
  projectId: string | undefined;
  fspId: string | undefined;
  districtId: string | undefined;
  workflowStateCode: string | undefined;
  forestClientName: string | undefined;
}

@Component({
    imports: [
    FormsModule,
    RxReactiveFormsModule,
    NgbDropdown,
    NgbDropdownToggle,
    NgbDropdownMenu,
    RouterLink,
    TitleCasePipe,
    DatePipe
],
    selector: 'app-search',
    templateUrl: './search.component.html',
    styleUrl: './search.component.scss'
})
export class SearchComponent implements OnInit, OnDestroy {
  private location = inject(Location);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private stateSvc = inject(StateService);
  private cognitoService = inject(CognitoService);
  snackBar = inject(MatSnackBar);
  searchProjectService = inject(ProjectService);
  private modalSvc = inject(ModalService);

  readonly projectPlanCodeEnum = ProjectPlanCodeEnum;
  private destroyRef = inject(DestroyRef);
  private paramMap: ParamMap | null = null;
  private snackBarRef: MatSnackBarRef<SimpleSnackBar> | null = null;
  // Populated from the authenticated Cognito session in the constructor.
  public user!: User;
  public fNumber: number | null; // filter: FOM Number
  public fFspId: number | null; // filter: FSP ID
  public fStatus: string | undefined; // filter: workflowStateCode
  public fDistrict: number | null; // filter: district id
  public fHolder: string | null; // filter: part of FOM holder name
  public statusCodes = this.stateSvc.getCodeTable('workflowResponseCode');
  public districts = this.stateSvc.getCodeTable('district');

  // Committed search criteria that drives the resource. `undefined` means "no search requested yet"
  // (the loader stays idle). A defined object — even with all-null filters — runs a search, which
  // preserves "submit with empty filters searches all" while "load with no query params" does not.
  private readonly criteria = signal<FindArgs | undefined>(undefined);

  // Signal-native data loading. rxResource consumes the generated client's Observable directly
  // and cancels the previous request when `criteria` changes.
  private readonly projectsResource = rxResource({
    params: () => this.criteria(),
    stream: ({ params }) => this.searchProjectService.projectControllerFind(
      params.projectId, params.fspId, params.districtId, params.workflowStateCode, params.forestClientName),
    defaultValue: [] as ProjectResponse[],
  });

  // `value()` throws while the resource is in the error state, so guard reads with hasValue().
  readonly projects = computed<ProjectResponse[]>(() =>
    this.projectsResource.hasValue() ? this.projectsResource.value() : []);
  readonly count = computed(() => this.projects().length);
  readonly searching = this.projectsResource.isLoading;
  // A search has been performed once the resource leaves 'idle' (i.e. resolved or errored).
  readonly searched = computed(() => this.projectsResource.status() !== 'idle');

  constructor() {
    const user = this.cognitoService.getUser();
    if (user) {
      this.user = user;
    }

    // Warn when the backend result cap is hit (replaces the check in the old subscribe callback).
    effect(() => {
      if (!this.projectsResource.hasValue()) return;
      const limit = 2500;
      if (this.projectsResource.value().length >= limit) {
        this.modalSvc.openSnackBar({message: `Warning: Maximum of ${limit} search results exceeded -
            not all results have been displayed. Please refine your search criteria.`, button: 'OK'});
      }
    });

    // Surface search failures (replaces the error branch of the old subscribe callback).
    effect(() => {
      const error = this.projectsResource.error();
      if (error) {
        console.error('SearchComponent.search() - error =', error);
        this.snackBarRef = this.snackBar.open('Error searching foms ...', undefined, {duration: 3000});
      }
    });
  }

  ngOnInit() {
    // get search terms from route
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(paramMap => {
      this.paramMap = paramMap;
      this.setInitialQueryParameters();

      if (this.fNumber || this.fFspId || this.fStatus || this.fDistrict || this.fHolder) {
        this.criteria.set(this.buildFindArgs());
      }
    });
  }

  private buildFindArgs(): FindArgs {
    return {
      projectId: (isNullish(this.fNumber) || isNaN(this.fNumber)) ? undefined : this.fNumber.toString(),
      fspId: (isNullish(this.fFspId) || isNaN(this.fFspId)) ? undefined : this.fFspId.toString(),
      districtId: (isNullish(this.fDistrict) || isNaN(this.fDistrict)) ? undefined : this.fDistrict.toString(),
      workflowStateCode: this.fStatus === 'undefined' ? undefined : this.fStatus,
      forestClientName: this.fHolder ?? undefined,
    };
  }

  public setInitialQueryParameters() {
    if (!this.paramMap) {
      return;
    }
    const fNumberParam = this.paramMap.get('fNumber');
    const fFspIdParam = this.paramMap.get('fFspId');
    const fDistrictParam = this.paramMap.get('fDistrict');
    this.fNumber = fNumberParam ? parseInt(fNumberParam) : null;
    this.fFspId = fFspIdParam ? parseInt(fFspIdParam) : null;
    this.fDistrict = fDistrictParam ? parseInt(fDistrictParam) : null;
    this.fStatus = this.paramMap.get('fStatus') || undefined;
    this.fHolder = this.paramMap.get('fHolder') || null;
  }

  public saveQueryParameters() {
    const params: Params = {};

    if (this.fFspId != null && !isNaN(this.fFspId)) {
      params['fFspId'] = this.fFspId;
    }
    if (this.fDistrict != null && !isNaN(this.fDistrict)) {
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
    this.criteria.set(this.buildFindArgs());
  }

  public clearQueryParameters(): void {
    this.fFspId = null;
    this.fDistrict = null;
    this.fStatus = undefined;
    this.fHolder = null;
    this.fNumber = null;
    this.saveQueryParameters();
    this.criteria.set(undefined);
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

  public getProjectPlanNumber(project: ProjectResponse) {
    // There are only two projectPlanCode for now.
    return project.projectPlanCode == this.projectPlanCodeEnum.Fsp?
      "FSP #" + project.fspId :
      "WL #" + project.woodlotLicenseNumber
  }

  ngOnDestroy() {
    if (this.snackBarRef) {
      this.snackBarRef.dismiss();
    }
  }
}
