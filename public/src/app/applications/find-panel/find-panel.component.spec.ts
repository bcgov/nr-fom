import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, Subject } from 'rxjs';
import { FindPanelComponent } from './find-panel.component';
import { FOMFiltersService, FOM_FILTER_NAME, COMMENT_STATUS_FILTER_PARAMS } from '@public-core/services/fomFilters.service';
import { UrlService } from '@public-core/services/url.service';
import { Filter, MultiFilter, FilterUtils } from '../utils/filter';

describe('FindPanelComponent', () => {
  let component: FindPanelComponent;
  let fixture: ComponentFixture<FindPanelComponent>;
  let mockUrlService: Partial<UrlService>;
  let mockFomFiltersSvc: Partial<FOMFiltersService>;
  let filtersSubject: BehaviorSubject<Map<string, any>>;
  let navEndSubject: Subject<any>;

  function createDefaultFilters(): Map<string, any> {
    const filters = new Map();
    const commentStatusFilters = new MultiFilter<boolean>({
      queryParamsKey: FOM_FILTER_NAME.COMMENT_STATUS,
      filters: [
        { queryParam: COMMENT_STATUS_FILTER_PARAMS.COMMENT_OPEN, displayString: 'Commenting Open', value: true },
        { queryParam: COMMENT_STATUS_FILTER_PARAMS.COMMENT_CLOSED, displayString: 'Commenting Closed', value: false },
      ],
    });
    filters.set(FOM_FILTER_NAME.FOM_NUMBER, new Filter<number>({ filter: { queryParam: FOM_FILTER_NAME.FOM_NUMBER, value: null } }));
    filters.set(FOM_FILTER_NAME.FOREST_CLIENT_NAME, new Filter<string>({ filter: { queryParam: FOM_FILTER_NAME.FOREST_CLIENT_NAME, value: null } }));
    filters.set(FOM_FILTER_NAME.COMMENT_STATUS, commentStatusFilters);
    filters.set(FOM_FILTER_NAME.POSTED_ON_AFTER, new Filter<Date>({ filter: { queryParam: FOM_FILTER_NAME.POSTED_ON_AFTER, value: null } }));
    return filters;
  }

  beforeEach(async () => {
    navEndSubject = new Subject<any>();
    filtersSubject = new BehaviorSubject<Map<string, any>>(createDefaultFilters());

    mockUrlService = {
      onNavEnd$: navEndSubject.asObservable() as any,
      getQueryParam: jest.fn().mockReturnValue(null),
      setQueryParam: jest.fn(),
      setFragment: jest.fn(),
    };

    mockFomFiltersSvc = {
      filters$: filtersSubject.asObservable(),
      clearFilters: jest.fn(),
      updateFiltersSelection: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [FindPanelComponent, RouterTestingModule, FormsModule],
      providers: [
        { provide: UrlService, useValue: mockUrlService },
        { provide: FOMFiltersService, useValue: mockFomFiltersSvc },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FindPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have maxInputLength of 9', () => {
    expect(component.maxInputLength).toBe(9);
  });

  it('should have minDate set to 2018-03-23', () => {
    expect(component.minDate).toBeDefined();
    expect(component.minDate.getFullYear()).toBe(2018);
    expect(component.minDate.getMonth()).toBe(2); // March (0-indexed)
    expect(component.minDate.getDate()).toBe(23);
  });

  describe('verifyFomNumberInput', () => {
    it('should parse valid integer input', () => {
      const event = { target: { value: '123' } };
      component.verifyFomNumberInput(event);
      expect(component.fomNumberFilter.filter.value).toBe(123);
    });

    it('should strip leading zeros', () => {
      const event = { target: { value: '007' } };
      component.verifyFomNumberInput(event);
      expect(component.fomNumberFilter.filter.value).toBe(7);
    });

    it('should set null for NaN input', () => {
      const event = { target: { value: 'abc' } };
      component.verifyFomNumberInput(event);
      expect(component.fomNumberFilter.filter.value).toBeNull();
    });

    it('should set null for zero input', () => {
      const event = { target: { value: '0' } };
      component.verifyFomNumberInput(event);
      expect(component.fomNumberFilter.filter.value).toBeNull();
    });
  });

  describe('verifyStatus', () => {
    it('should set commentOpen to true if both are false', () => {
      component.commentStatusFilters.filters.forEach(f => f.value = false);
      component.verifyStatus();
      const commentOpen = component.commentStatusFilters.filters.find(
        f => f.queryParam === COMMENT_STATUS_FILTER_PARAMS.COMMENT_OPEN
      );
      expect(commentOpen.value).toBe(true);
    });

    it('should not change values if at least one is true', () => {
      component.commentStatusFilters.filters[0].value = true;
      component.commentStatusFilters.filters[1].value = false;
      component.verifyStatus();
      expect(component.commentStatusFilters.filters[0].value).toBe(true);
      expect(component.commentStatusFilters.filters[1].value).toBe(false);
    });
  });

  describe('toggleFilter', () => {
    it('should toggle filter value from true to false', () => {
      const filter = { queryParam: 'test', displayString: 'Test', value: true };
      component.toggleFilter(filter);
      expect(filter.value).toBe(false);
    });

    it('should toggle filter value from false to true', () => {
      const filter = { queryParam: 'test', displayString: 'Test', value: false };
      component.toggleFilter(filter);
      expect(filter.value).toBe(true);
    });
  });

  describe('clear', () => {
    it('should call clearFilters and emit update', () => {
      const emitSpy = jest.spyOn(component.update, 'emit');
      component.clear();
      expect(mockFomFiltersSvc.clearFilters).toHaveBeenCalled();
      expect(emitSpy).toHaveBeenCalledWith({ search: true, resetMap: true, hidePanel: true });
    });
  });

  describe('clearAllFilters', () => {
    it('should call fomFiltersSvc.clearFilters', () => {
      component.clearAllFilters();
      expect(mockFomFiltersSvc.clearFilters).toHaveBeenCalled();
    });
  });

  describe('checkAndSetFiltersHash', () => {
    it('should return true on first call (no previous hash)', () => {
      expect(component.checkAndSetFiltersHash()).toBe(true);
    });

    it('should return false if filters have not changed', () => {
      component.checkAndSetFiltersHash();
      expect(component.checkAndSetFiltersHash()).toBe(false);
    });

    it('should return true if filters have changed', () => {
      component.checkAndSetFiltersHash();
      component.fomNumberFilter.filter.value = 42;
      expect(component.checkAndSetFiltersHash()).toBe(true);
    });
  });

  describe('emitUpdate', () => {
    it('should emit when filters changed', () => {
      const emitSpy = jest.spyOn(component.update, 'emit');
      component.emitUpdate({ search: true });
      expect(emitSpy).toHaveBeenCalledWith({ search: true });
    });

    it('should not emit when filters unchanged', () => {
      const emitSpy = jest.spyOn(component.update, 'emit');
      component.checkAndSetFiltersHash(); // set initial hash
      component.emitUpdate({ search: true });
      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  describe('ngOnDestroy', () => {
    it('should unsubscribe', () => {
      const nextSpy = jest.spyOn(component['ngUnsubscribe'], 'next');
      const completeSpy = jest.spyOn(component['ngUnsubscribe'], 'complete');
      component.ngOnDestroy();
      expect(nextSpy).toHaveBeenCalled();
      expect(completeSpy).toHaveBeenCalled();
    });
  });
});
