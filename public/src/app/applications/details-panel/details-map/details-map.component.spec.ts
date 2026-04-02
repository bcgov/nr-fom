import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DetailsMapComponent } from './details-map.component';
import { MapLayersService } from '@public-core/services/mapLayers.service';
import { FeatureSelectService } from '@utility/services/featureSelect.service';
import { Subject } from 'rxjs';

describe('DetailsMapComponent', () => {
  let component: DetailsMapComponent;
  let fixture: ComponentFixture<DetailsMapComponent>;
  let mockMapLayersService: Partial<MapLayersService>;
  let mockFeatureSelectService: Partial<FeatureSelectService>;

  beforeEach(async () => {
    mockMapLayersService = {
      $mapLayersChange: { subscribe: jest.fn() } as any,
      notifyLayersChange: jest.fn(),
      mapLayersUpdate: jest.fn(),
      applyCurrentMapLayers: jest.fn(),
    };

    mockFeatureSelectService = {
      $currentSelected: new Subject<any>(),
    };

    await TestBed.configureTestingModule({
      imports: [DetailsMapComponent],
      providers: [
        { provide: MapLayersService, useValue: mockMapLayersService },
        { provide: FeatureSelectService, useValue: mockFeatureSelectService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DetailsMapComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('resetMap', () => {
    it('should not throw when map is null', () => {
      component.map = null;
      expect(() => component.resetMap()).not.toThrow();
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

  describe('input properties', () => {
    it('should accept projectSpatialDetail input', () => {
      const details = [
        { featureId: 1, featureType: { code: 'cut_block' } },
      ] as any;
      component.projectSpatialDetail = details;
      expect(component.projectSpatialDetail).toBe(details);
    });
  });
});
