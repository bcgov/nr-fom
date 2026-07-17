import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { SpatialFeaturePublicResponse } from '@api-client';
import { FeatureSelectService } from '@utility/services/featureSelect.service';

@Component({
  standalone: true,
  imports: [CommonModule, MatTableModule],
  selector: 'app-shape-info',
  templateUrl: './shape-info.component.html',
  styleUrls: ['./shape-info.component.scss']
})
export class ShapeInfoComponent {
  private fss = inject(FeatureSelectService);


  slideColor: ThemePalette = 'primary';
  displayedColumns: string[] = ['shape_id', 'type', 'name', 'submission_type', 'area_length', 'development_date'];
  selectedRowIndex: string = null;

  @Input('spatialDetail')
  projectSpatialDetail: SpatialFeaturePublicResponse[];

  onRowSelected(rowData: SpatialFeaturePublicResponse) {
    this.selectedRowIndex = rowData.featureId + '-' + rowData.featureType.code; // Unique when featureType is included.
    this.fss.changeSelectedFeature(this.selectedRowIndex);
  }
}
