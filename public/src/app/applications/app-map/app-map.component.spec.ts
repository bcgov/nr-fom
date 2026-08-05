import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
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
  let mapLayersChange$: Subject<void>;

  beforeEach(async () => {
    mockUrlService = {
      getQueryParam: jest.fn().mockReturnValue(null),
    };

    mapLayersChange$ = new Subject<void>();
    mockMapLayersService = {
      $mapLayersChange: mapLayersChange$ as any,
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

    it('should unsubscribe from map-layer changes when destroyed', () => {
      component.ngOnInit(); // subscribes to $mapLayersChange
      expect(mapLayersChange$.observed).toBe(true);
      fixture.destroy();
      expect(mapLayersChange$.observed).toBe(false);
    });
  });

  describe('unhighlightApplications', () => {
    it('should not throw when currentMarker is null', () => {
      expect(() => component.unhighlightApplications()).not.toThrow();
    });
  });

  describe('map sizing (ResizeObserver)', () => {
    it('invalidates map size on every container resize callback, and disconnects on destroy', () => {
      const invalidateSize = jest.fn();
      const container = document.createElement('div');
      (component as any).map = {
        invalidateSize,
        getContainer: () => container,
        setView: jest.fn(),
        fitBounds: jest.fn(),
        eachLayer: jest.fn(),
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

      (component as any).observeMapSizing();

      // Observer is attached to the map container; invalidateSize is now driven entirely
      // by the observer callback (initial layout + every subsequent resize), not by a
      // synchronous call.
      expect(observe).toHaveBeenCalledWith(container);
      expect(invalidateSize).toHaveBeenCalledTimes(0);

      resizeCb(); // initial layout callback
      expect(invalidateSize).toHaveBeenCalledTimes(1);

      resizeCb(); // a later container resize
      expect(invalidateSize).toHaveBeenCalledTimes(2);

      component.ngOnDestroy();
      expect(disconnect).toHaveBeenCalled();
    });
  });

  describe('input properties', () => {
    it('should accept loading input', () => {
      fixture.componentRef.setInput('loading', true);
      expect(component.loading()).toBe(true);
    });

    it('should accept projectsSummary input', () => {
      const summary = [{ id: 1, name: 'Project 1' }] as any;
      fixture.componentRef.setInput('projectsSummary', summary);
      expect(component.projectsSummary()).toBe(summary);
    });
  });
});
