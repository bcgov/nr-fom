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
  let mapLayersChange$: Subject<void>;
  let currentSelected$: Subject<any>;

  beforeEach(async () => {
    mapLayersChange$ = new Subject<void>();
    currentSelected$ = new Subject<any>();

    mockMapLayersService = {
      $mapLayersChange: mapLayersChange$ as any,
      notifyLayersChange: jest.fn(),
      mapLayersUpdate: jest.fn(),
      applyCurrentMapLayers: jest.fn(),
    };

    mockFeatureSelectService = {
      $currentSelected: currentSelected$,
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

  describe('teardown', () => {
    it('should unsubscribe from service streams when destroyed', () => {
      component.ngOnInit(); // subscribes to $mapLayersChange and $currentSelected
      expect(mapLayersChange$.observed).toBe(true);
      expect(currentSelected$.observed).toBe(true);
      fixture.destroy();
      expect(mapLayersChange$.observed).toBe(false);
      expect(currentSelected$.observed).toBe(false);
    });
  });

  describe('input properties', () => {
    it('should accept projectSpatialDetail input', () => {
      const details = [
        { featureId: 1, featureType: { code: 'cut_block' } },
      ] as any;
      fixture.componentRef.setInput('projectSpatialDetail', details);
      expect(component.projectSpatialDetail()).toBe(details);
    });
  });
});
