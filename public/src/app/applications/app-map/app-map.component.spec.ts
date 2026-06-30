import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppMapComponent } from './app-map.component';
import { UrlService } from '@public-core/services/url.service';
import { MapLayersService } from '@public-core/services/mapLayers.service';

// Mock leaflet.markercluster globally
jest.mock('leaflet.markercluster', () => ({}), { virtual: true });

// Mock leaflet to provide markerClusterGroup
jest.mock('leaflet', () => {
  const actual = jest.requireActual('leaflet');
  return {
    ...actual,
    markerClusterGroup: jest.fn().mockReturnValue({
      addLayer: jest.fn(),
      removeLayer: jest.fn(),
    }),
    icon: jest.fn().mockReturnValue({}),
  };
});

describe('AppMapComponent', () => {
  let component: AppMapComponent;
  let fixture: ComponentFixture<AppMapComponent>;
  let mockUrlService: Partial<UrlService>;
  let mockMapLayersService: Partial<MapLayersService>;

  beforeEach(async () => {
    mockUrlService = {
      getQueryParam: jest.fn().mockReturnValue(null),
    };

    mockMapLayersService = {
      $mapLayersChange: { subscribe: jest.fn() } as any,
      notifyLayersChange: jest.fn(),
      mapLayersUpdate: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AppMapComponent],
      providers: [
        provideRouter([]),
        { provide: UrlService, useValue: mockUrlService },
        { provide: MapLayersService, useValue: mockMapLayersService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AppMapComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have defaultBounds defined', () => {
    expect(component.defaultBounds).toBeDefined();
  });

  it('should have projectPlanCodeEnum', () => {
    expect(component.projectPlanCodeEnum).toBeDefined();
  });

  describe('ngOnDestroy', () => {
    it('should not throw when map is null', () => {
      expect(() => component.ngOnDestroy()).not.toThrow();
    });

    it('should unsubscribe', () => {
      const nextSpy = jest.spyOn(component['ngUnsubscribe'], 'next');
      const completeSpy = jest.spyOn(component['ngUnsubscribe'], 'complete');
      component.ngOnDestroy();
      expect(nextSpy).toHaveBeenCalled();
      expect(completeSpy).toHaveBeenCalled();
    });
  });

  describe('unhighlightApplications', () => {
    it('should not throw when currentMarker is null', () => {
      expect(() => component.unhighlightApplications()).not.toThrow();
    });
  });

  describe('fixMap resize handling', () => {
    it('invalidates map size on init and on every container resize, and disconnects on destroy', () => {
      const invalidateSize = jest.fn();
      const container = document.createElement('div');
      (component as any).map = {
        invalidateSize,
        getContainer: () => container,
        setView: jest.fn(),
        fitBounds: jest.fn(),
        remove: jest.fn(),
      };
      // pretend the host element is laid out / visible
      Object.defineProperty(component['elementRef'].nativeElement, 'offsetParent', {
        value: document.body,
        configurable: true,
      });

      let resizeCb: () => void = () => undefined;
      const observe = jest.fn();
      const disconnect = jest.fn();
      (global as any).ResizeObserver = jest.fn().mockImplementation((cb: () => void) => {
        resizeCb = cb;
        return { observe, disconnect };
      });

      (component as any).fixMap();

      expect(observe).toHaveBeenCalledWith(container);
      expect(invalidateSize).toHaveBeenCalledTimes(1); // initial invalidate

      resizeCb(); // simulate the container settling to its real size
      expect(invalidateSize).toHaveBeenCalledTimes(2);

      component.ngOnDestroy();
      expect(disconnect).toHaveBeenCalled();
    });
  });

  describe('input properties', () => {
    it('should accept loading input', () => {
      component.loading = true;
      expect(component.loading).toBe(true);
    });

    it('should accept projectsSummary input', () => {
      const summary = [{ id: 1, name: 'Project 1' }] as any;
      component.projectsSummary = summary;
      expect(component.projectsSummary).toBe(summary);
    });
  });
});
