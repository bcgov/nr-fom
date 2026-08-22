import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { ProjectService } from '@api-client';
import { CognitoService } from '@admin-core/services/cognito.service';
import { ModalService } from '@admin-core/services/modal.service';
import { StateService } from '@admin-core/services/state.service';
import { SearchComponent } from './search.component';

const makeProject = (id: number) =>
  ({
    id,
    name: `FOM ${id}`,
    projectPlanCode: 'FSP',
    fspId: id,
    woodlotLicenseNumber: null,
    forestClient: { id: `c${id}`, name: 'client' },
    district: { name: 'District' },
    workflowState: { code: 'INITIAL', description: 'Initial' },
    commentingClosedDate: null,
  }) as any;

describe('SearchComponent', () => {
  let fixture: ComponentFixture<SearchComponent>;
  let component: SearchComponent;
  let queryParams$: BehaviorSubject<ParamMap>;
  let find: jest.Mock;
  let openSnackBar: jest.Mock;
  let snackBarOpen: jest.Mock;

  function setup(initialParams: Record<string, string> = {}) {
    queryParams$ = new BehaviorSubject<ParamMap>(convertToParamMap(initialParams));
    find = jest.fn().mockReturnValue(of([]));
    openSnackBar = jest.fn();
    snackBarOpen = jest.fn().mockReturnValue({ dismiss: jest.fn() });

    TestBed.configureTestingModule({
      imports: [SearchComponent, NoopAnimationsModule],
      providers: [
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParams$.asObservable() } },
        { provide: Router, useValue: { createUrlTree: jest.fn().mockReturnValue({ toString: () => '' }) } },
        { provide: Location, useValue: { go: jest.fn() } },
        { provide: ProjectService, useValue: { projectControllerFind: find } },
        { provide: CognitoService, useValue: { getUser: () => ({ isMinistry: true, isAuthorizedForClientId: () => true }) } },
        { provide: ModalService, useValue: { openSnackBar } },
        { provide: StateService, useValue: { getCodeTable: () => [] } },
        { provide: MatSnackBar, useValue: { open: snackBarOpen } },
      ],
    });
    fixture = TestBed.createComponent(SearchComponent);
    component = fixture.componentInstance;
  }

  // Flush ngOnInit, the resource load, and the reactive effects (zoneless: await stability).
  async function flushSearch() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('creates', () => {
    setup();
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('does not search on load when there are no query params', async () => {
    setup({});
    await flushSearch();
    expect(find).not.toHaveBeenCalled();
    expect(component.searched()).toBe(false);
    expect(component.count()).toBe(0);
  });

  it('auto-searches on load when a filter query param is present', async () => {
    setup({ fFspId: '5' });
    find.mockReturnValue(of([makeProject(1), makeProject(2)]));
    await flushSearch();

    expect(find).toHaveBeenCalledTimes(1);
    // (projectId, fspId, districtId, workflowStateCode, forestClientName)
    expect(find).toHaveBeenCalledWith(undefined, '5', undefined, undefined, undefined);
    expect(component.count()).toBe(2);
    expect(component.searched()).toBe(true);
    expect(component.searching()).toBe(false);
  });

  it('auto-searches by FOM number from the URL (deep-link fix)', async () => {
    setup({ fNumber: '42' });
    find.mockReturnValue(of([makeProject(42)]));
    await flushSearch();

    expect(component.fNumber).toBe(42); // restored into the form
    expect(find).toHaveBeenCalledWith('42', undefined, undefined, undefined, undefined);
    expect(component.count()).toBe(1);
  });

  it('searches on submit (empty filters search all)', async () => {
    setup({});
    await flushSearch();
    expect(find).not.toHaveBeenCalled();

    component.onSubmit();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(find).toHaveBeenCalledWith(undefined, undefined, undefined, undefined, undefined);
    expect(component.searched()).toBe(true);
  });

  it('warns when the maximum result cap is reached', async () => {
    const many = Array.from({ length: 2500 }, (_, i) => makeProject(i));
    setup({ fFspId: '5' });
    find.mockReturnValue(of(many));
    await flushSearch();

    expect(openSnackBar).toHaveBeenCalledTimes(1);
    expect(component.count()).toBe(2500);
  });

  it('shows an error snackbar and clears results when the search fails', async () => {
    setup({ fFspId: '5' });
    find.mockReturnValue(throwError(() => new Error('boom')));
    await flushSearch();

    expect(snackBarOpen).toHaveBeenCalledWith('Error searching foms ...', undefined, { duration: 3000 });
    expect(component.count()).toBe(0);
    expect(component.searched()).toBe(true);
    expect(component.searching()).toBe(false);
  });

  it('ignores invalid or out-of-range fNumber and fFspId in URL query params', async () => {
    setup({ fNumber: '9999999999', fFspId: '0' });
    await flushSearch();

    expect(component.fNumber).toBeNull();
    expect(component.fFspId).toBeNull();
    expect(find).not.toHaveBeenCalled();
    expect(component.searched()).toBe(false);
  });

  it('clears query parameters and resets criteria on clearQueryParameters', async () => {
    setup({ fFspId: '5' });
    find.mockReturnValue(of([makeProject(1)]));
    await flushSearch();

    expect(component.fFspId).toBe(5);

    component.clearQueryParameters();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.fFspId).toBeNull();
    expect(component.fNumber).toBeNull();
  });
});
