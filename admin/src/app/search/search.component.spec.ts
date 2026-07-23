import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
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

  // Flush ngOnInit, the resource load, and the reactive effects.
  function flushSearch() {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
  }

  it('creates', () => {
    setup();
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('does not search on load when there are no query params', fakeAsync(() => {
    setup({});
    flushSearch();
    expect(find).not.toHaveBeenCalled();
    expect(component.searched()).toBe(false);
    expect(component.count()).toBe(0);
  }));

  it('auto-searches on load when a filter query param is present', fakeAsync(() => {
    setup({ fFspId: '5' });
    find.mockReturnValue(of([makeProject(1), makeProject(2)]));
    flushSearch();

    expect(find).toHaveBeenCalledTimes(1);
    // (projectId, fspId, districtId, workflowStateCode, forestClientName)
    expect(find).toHaveBeenCalledWith(null, '5', null, undefined, null);
    expect(component.count()).toBe(2);
    expect(component.searched()).toBe(true);
    expect(component.searching()).toBe(false);
  }));

  it('auto-searches by FOM number from the URL (deep-link fix)', fakeAsync(() => {
    setup({ fNumber: '42' });
    find.mockReturnValue(of([makeProject(42)]));
    flushSearch();

    expect(component.fNumber).toBe(42); // restored into the form
    expect(find).toHaveBeenCalledWith('42', null, null, undefined, null);
    expect(component.count()).toBe(1);
  }));

  it('searches on submit (empty filters search all)', fakeAsync(() => {
    setup({});
    flushSearch();
    expect(find).not.toHaveBeenCalled();

    component.onSubmit();
    fixture.detectChanges();
    tick();

    expect(find).toHaveBeenCalledWith(null, null, null, undefined, null);
    expect(component.searched()).toBe(true);
  }));

  it('warns when the maximum result cap is reached', fakeAsync(() => {
    const many = Array.from({ length: 2500 }, (_, i) => makeProject(i));
    setup({ fFspId: '5' });
    find.mockReturnValue(of(many));
    flushSearch();

    expect(openSnackBar).toHaveBeenCalledTimes(1);
    expect(component.count()).toBe(2500);
  }));

  it('shows an error snackbar and clears results when the search fails', fakeAsync(() => {
    setup({ fFspId: '5' });
    find.mockReturnValue(throwError(() => new Error('boom')));
    flushSearch();

    expect(snackBarOpen).toHaveBeenCalledWith('Error searching foms ...', null, { duration: 3000 });
    expect(component.count()).toBe(0);
    expect(component.searched()).toBe(true);
    expect(component.searching()).toBe(false);
  }));
});
