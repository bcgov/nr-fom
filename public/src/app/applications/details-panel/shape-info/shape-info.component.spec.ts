import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShapeInfoComponent } from './shape-info.component';
import { FeatureSelectService } from '@utility/services/featureSelect.service';

describe('ShapeInfoComponent', () => {
  let component: ShapeInfoComponent;
  let fixture: ComponentFixture<ShapeInfoComponent>;
  let mockFeatureSelectService: Partial<FeatureSelectService>;

  beforeEach(async () => {
    mockFeatureSelectService = {
      changeSelectedFeature: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ShapeInfoComponent],
      providers: [
        { provide: FeatureSelectService, useValue: mockFeatureSelectService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ShapeInfoComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have correct displayed columns', () => {
    expect(component.displayedColumns).toEqual([
      'shape_id', 'type', 'name', 'submission_type', 'area_length', 'development_date'
    ]);
  });

  it('should start with no selected row', () => {
    expect(component.selectedRowIndex).toBeNull();
  });

  it('should have slideColor set to primary', () => {
    expect(component.slideColor).toBe('primary');
  });

  describe('onRowSelected', () => {
    it('should set selectedRowIndex from featureId and featureType code', () => {
      const rowData = { featureId: 5, featureType: { code: 'cut_block' } };
      component.onRowSelected(rowData as any);
      expect(component.selectedRowIndex).toBe('5-cut_block');
    });

    it('should call featureSelectService.changeSelectedFeature', () => {
      const rowData = { featureId: 5, featureType: { code: 'cut_block' } };
      component.onRowSelected(rowData as any);
      expect(mockFeatureSelectService.changeSelectedFeature).toHaveBeenCalledWith('5-cut_block');
    });

    it('should update selectedRowIndex on subsequent selections', () => {
      component.onRowSelected({ featureId: 1, featureType: { code: 'road_section' } } as any);
      expect(component.selectedRowIndex).toBe('1-road_section');
      component.onRowSelected({ featureId: 2, featureType: { code: 'cut_block' } } as any);
      expect(component.selectedRowIndex).toBe('2-cut_block');
    });
  });

  describe('spatialDetail input', () => {
    it('should accept spatialDetail input', () => {
      const mockSpatialDetail = [
        { featureId: 1, featureType: { code: 'cut_block' }, name: 'Block A' },
        { featureId: 2, featureType: { code: 'road_section' }, name: 'Road 1' },
      ];
      component.projectSpatialDetail = mockSpatialDetail as any;
      expect(component.projectSpatialDetail.length).toBe(2);
    });
  });
});
