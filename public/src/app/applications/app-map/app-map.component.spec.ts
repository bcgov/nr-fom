import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
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
      imports: [AppMapComponent, RouterTestingModule],
      providers: [
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
