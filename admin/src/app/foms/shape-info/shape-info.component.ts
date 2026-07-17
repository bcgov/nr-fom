import { Component, Input, OnInit } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { SpatialFeaturePublicResponse } from '@api-client';
import { FeatureSelectService } from '@utility/services/featureSelect.service';
import { NgClass, DecimalPipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';

@Component({
    selector: 'app-shape-info',
    templateUrl: './shape-info.component.html',
    styleUrls: ['./shape-info.component.scss'],
    standalone: true,
    imports: [MatTableModule, NgClass, DecimalPipe]
})
export class ShapeInfoComponent implements OnInit {

  slideColor: ThemePalette = 'primary';
  displayedColumns: string[] = ['shape_id', 'type', 'name', 'submission_type', 'area_length', 'development_date'];
  selectedRowIndex: string = null;

  @Input('spatialDetail')
  projectSpatialDetail: SpatialFeaturePublicResponse[];

  constructor(private fss: FeatureSelectService) { 
    // Deliberately empty
  }

  ngOnInit(): void {
    // Deliberately empty
  }

  onRowSelected(rowData: SpatialFeaturePublicResponse) {
    this.selectedRowIndex = rowData.featureId + '-' + rowData.featureType.code; // Unique when featureType is included.
    this.fss.changeSelectedFeature(this.selectedRowIndex);
  }
}
