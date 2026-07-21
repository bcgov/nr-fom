import { Component, OnInit, inject, input } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { SpatialFeaturePublicResponse } from '@api-client';
import { FeatureSelectService } from '@utility/services/featureSelect.service';
import { DecimalPipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';

@Component({
    selector: 'app-shape-info',
    templateUrl: './shape-info.component.html',
    styleUrl: './shape-info.component.scss',
    imports: [MatTableModule, DecimalPipe]
})
export class ShapeInfoComponent implements OnInit {
  private fss = inject(FeatureSelectService);


  slideColor: ThemePalette = 'primary';
  displayedColumns: string[] = ['shape_id', 'type', 'name', 'submission_type', 'area_length', 'development_date'];
  selectedRowIndex: string = null;

  readonly projectSpatialDetail = input<SpatialFeaturePublicResponse[]>(undefined, { alias: "spatialDetail" });

  ngOnInit(): void {
    // Deliberately empty
  }

  onRowSelected(rowData: SpatialFeaturePublicResponse) {
    this.selectedRowIndex = rowData.featureId + '-' + rowData.featureType.code; // Unique when featureType is included.
    this.fss.changeSelectedFeature(this.selectedRowIndex);
  }
}
