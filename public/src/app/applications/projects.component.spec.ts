import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { ProjectsComponent } from './projects.component';
import { ProjectService } from '@api-client';
import { FOMFiltersService, FOM_FILTER_NAME } from '@public-core/services/fomFilters.service';
import { UrlService } from '@public-core/services/url.service';
import { Filter, MultiFilter } from './utils/filter';
import { Panel } from './utils/panel.enum';

describe('ProjectsComponent', () => {
  let component: ProjectsComponent;
  let mockModalService: Partial<NgbModal>;
  let mockProjectService: Partial<ProjectService>;
  let mockFomFiltersSvc: Partial<FOMFiltersService>;
  let mockUrlService: Partial<UrlService>;
  let filtersSubject: BehaviorSubject<Map<string, any>>;

  beforeEach(() => {
    filtersSubject = new BehaviorSubject<Map<string, any>>(new Map());

    mockModalService = {
      open: jest.fn().mockReturnValue({
        result: Promise.resolve(),
        dismiss: jest.fn(),
        close: jest.fn(),
      }),
    };

    mockProjectService = {
      projectControllerFindPublicSummary: jest.fn().mockReturnValue(of([])),
    };

    mockUrlService = {
      onNavEnd$: new Subject<any>().asObservable() as any,
      setFragment: jest.fn(),
      setQueryParam: jest.fn(),
    };

    const defaultFilters = new Map();
    const commentStatusFilters = new MultiFilter<boolean>({
      queryParamsKey: 'cmtStatus',
      filters: [
        { queryParam: 'COMMENT_OPEN', displayString: 'Commenting Open', value: true },
        { queryParam: 'COMMENT_CLOSED', displayString: 'Commenting Closed', value: false },
      ],
    });
    defaultFilters.set(FOM_FILTER_NAME.FOM_NUMBER, new Filter<number>({ filter: { queryParam: 'fomNumber', value: null } }));
    defaultFilters.set(FOM_FILTER_NAME.FOREST_CLIENT_NAME, new Filter<string>({ filter: { queryParam: 'fcName', value: null } }));
    defaultFilters.set(FOM_FILTER_NAME.COMMENT_STATUS, commentStatusFilters);
    defaultFilters.set(FOM_FILTER_NAME.POSTED_ON_AFTER, new Filter<Date>({ filter: { queryParam: 'pdOnAfter', value: null } }));
    filtersSubject.next(defaultFilters);

    mockFomFiltersSvc = {
      filters$: filtersSubject.asObservable(),
      clearFilters: jest.fn(),
      updateFilterSelection: jest.fn(),
    };

    // Instantiate directly to avoid child component DI issues
    component = new ProjectsComponent(
      mockModalService as any,
      null as any, // Router
      mockProjectService as any,
      mockUrlService as any,
      mockFomFiltersSvc as any,
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with no active panel', () => {
    expect(component.activePanel).toBeUndefined();
  });

  it('should start with loading false', () => {
    expect(component.loading).toBe(false);
  });

  describe('closeSidePanel', () => {
    it('should set activePanel to null', () => {
      component.activePanel = Panel.find;
      component.closeSidePanel();
      expect(component.activePanel).toBeNull();
    });

    it('should clear url fragment', () => {
      component.activePanel = Panel.find;
      component.closeSidePanel();
      expect(mockUrlService.setFragment).toHaveBeenCalledWith(null);
    });

    it('should do nothing if no panel is active', () => {
      component.activePanel = null;
      component.closeSidePanel();
      expect(mockUrlService.setFragment).not.toHaveBeenCalled();
    });
  });

  describe('togglePanel', () => {
    it('should activate panel when different panel is active', () => {
      (component as any).urlTree = { fragment: null };
      component.togglePanel(Panel.find);
      expect(component.activePanel).toBe(Panel.find);
      expect(mockUrlService.setFragment).toHaveBeenCalledWith(Panel.find);
    });

    it('should deactivate panel when same panel is toggled', () => {
      (component as any).urlTree = { fragment: 'find' };
      component.activePanel = Panel.find;
      component.togglePanel(Panel.find);
      expect(component.activePanel).toBeNull();
      expect(mockUrlService.setFragment).toHaveBeenCalledWith(null);
    });
  });

  describe('clearFilters', () => {
    it('should call fomFiltersSvc.clearFilters', () => {
      component.clearFilters();
      expect(mockFomFiltersSvc.clearFilters).toHaveBeenCalled();
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

    it('should dismiss splash modal if it exists', () => {
      const mockModal = { dismiss: jest.fn() };
      (component as any).splashModal = mockModal;
      component.ngOnDestroy();
      expect(mockModal.dismiss).toHaveBeenCalled();
    });

    it('should not throw if splash modal is null', () => {
      (component as any).splashModal = null;
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('displaySplashModal', () => {
    it('should open the splash modal', () => {
      component.displaySplashModal();
      expect(mockModalService.open).toHaveBeenCalled();
    });
  });

  describe('closeSplashModal', () => {
    it('should close the splash modal if it exists', () => {
      const mockModal = { close: jest.fn() };
      (component as any).splashModal = mockModal;
      component.closeSplashModal();
      expect(mockModal.close).toHaveBeenCalled();
    });

    it('should not throw if splash modal is null', () => {
      (component as any).splashModal = null;
      expect(() => component.closeSplashModal()).not.toThrow();
    });
  });

  describe('handleFindUpdate', () => {
    it('should handle hidePanel event', () => {
      component.activePanel = Panel.find;
      component.handleFindUpdate({ hidePanel: true });
      expect(component.activePanel).toBeNull();
    });
  });

  describe('handlePublicNoticesUpdate', () => {
    it('should handle hidePanel event', () => {
      component.activePanel = Panel.publicNotices;
      component.handlePublicNoticesUpdate({ hidePanel: true });
      expect(component.activePanel).toBeNull();
    });
  });
});
