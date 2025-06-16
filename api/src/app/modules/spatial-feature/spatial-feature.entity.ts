import { JoinColumn, ManyToOne, ViewColumn, ViewEntity } from 'typeorm';
import { ForestClient } from '../forest-client/forest-client.entity';
import { SubmissionTypeCode } from '../submission/submission-type-code.entity';

// This entity represents all the shapes (cut blocks, road sections, retention areas) for FOM projects
// denormalized and converted for easy rendering in leaflet and exporting to BCGW.
@ViewEntity('spatial_feature', {schema: 'app_fom'})
export class SpatialFeature {

  @ViewColumn({name: 'feature_id'})
  featureId: number;

  @ViewColumn({name: 'feature_type'})
  featureType: string;

  @ViewColumn()
  name: string;

  @ViewColumn({name: 'create_timestamp'})
  createTimestamp: string;

  // Loaded from DB as geojson string, converted to geojson object 
  @ViewColumn({name:"geojson"})
  geometry: string;

  // Loaded from DB as geojson string, converted to geojson object 
  @ViewColumn({ name: 'centroid' })
  centroid: string;

  @ViewColumn({name: 'planned_development_date'})
  plannedDevelopmentDate: string;

  @ViewColumn({name: 'planned_area_ha'})
  plannedAreaHa: number;

  @ViewColumn({name: 'planned_length_km'})
  plannedLengthKm: number;

  @ViewColumn({name: 'workflow_state_code'})
  workflowStateCode: string;

  @ManyToOne(() => ForestClient)
  @JoinColumn({ name: 'forest_client_number', referencedColumnName: 'id' })
  forestClient: ForestClient;

  @ManyToOne(() => SubmissionTypeCode)
  @JoinColumn({ name: 'submission_type_code', referencedColumnName: 'code' })
  submissionType: SubmissionTypeCode;

  @ViewColumn({name: 'project_id'})
  projectId: number;

  @ViewColumn({name: 'fom_name'})
  fom_name: string;
}
