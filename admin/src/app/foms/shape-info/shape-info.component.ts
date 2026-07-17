import { Component, Input, OnInit, inject } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { SpatialFeaturePublicResponse } from '@api-client';
import { FeatureSelectService } from '@utility/services/featureSelect.service';
import { NgClass, DecimalPipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';

@Component({
    selector: 'app-shape-info',
    templateUrl: './shape-info.component.html',
    styleUrl: './shape-info.component.scss',
    imports: [MatTableModule, NgClass, DecimalPipe]
})
export class ShapeInfoComponent implements OnInit {
  private fss = inject(FeatureSelectService);


  slideColor: ThemePalette = 'primary';
  displayedColumns: string[] = ['shape_id', 'type', 'name', 'submission_type', 'area_length', 'development_date'];
  selectedRowIndex: string = null;

  @Input('spatialDetail')
  projectSpatialDetail: SpatialFeaturePublicResponse[];

  ngOnInit(): void {
    // Deliberately empty
  }

  onRowSelected(rowData: SpatialFeaturePublicResponse) {
    this.selectedRowIndex = rowData.featureId + '-' + rowData.featureType.code; // Unique when featureType is included.
    this.fss.changeSelectedFeature(this.selectedRowIndex);
  }
}
