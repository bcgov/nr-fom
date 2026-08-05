import { DecimalPipe } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { SpatialFeaturePublicResponse } from '@api-client';
import { FeatureSelectService } from '@utility/services/featureSelect.service';

@Component({
  imports: [DecimalPipe, MatTableModule],
  selector: 'app-shape-info',
  templateUrl: './shape-info.component.html',
  styleUrl: './shape-info.component.scss'
})
export class ShapeInfoComponent {
  private fss = inject(FeatureSelectService);


  slideColor: ThemePalette = 'primary';
  displayedColumns: string[] = ['shape_id', 'type', 'name', 'submission_type', 'area_length', 'development_date'];
  selectedRowIndex: string | null = null;

  readonly projectSpatialDetail = input<SpatialFeaturePublicResponse[] | undefined>(undefined, { alias: "spatialDetail" });

  onRowSelected(rowData: SpatialFeaturePublicResponse) {
    this.selectedRowIndex = rowData.featureId + '-' + rowData.featureType.code; // Unique when featureType is included.
    this.fss.changeSelectedFeature(this.selectedRowIndex);
  }

  // `geometry` is typed `object` by the generated client; expose its GeoJSON `type` discriminator.
  getGeometryType(feature: SpatialFeaturePublicResponse): string | undefined {
    return (feature.geometry as { type?: string }).type;
  }
}
