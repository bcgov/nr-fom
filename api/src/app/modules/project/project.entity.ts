import { ApiBaseEntity } from '@entities';
import { ProjectPlanCode } from '@src/app/modules/project/project-plan-code.entity';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { District } from '../district/district.entity';
import { ForestClient } from '../forest-client/forest-client.entity';
import { Submission } from '../submission/submission.entity';
import { FomPoint } from './project.dto';
import { PublicNotice } from './public-notice.entity';
import { WorkflowStateCode } from './workflow-state-code.entity';
import { CutBlock } from '../submission/cut-block.entity';
import { RoadSection } from '../submission/road-section.entity';

@Entity('project', {schema: 'app_fom'})
export class Project extends ApiBaseEntity<Project> {
  constructor(project?: Partial<Project>) {
    super(project);
  }

  @PrimaryGeneratedColumn('increment', {name: 'project_id'})
  public id: number;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column({ name: 'commenting_open_date', type: 'date'})
  commentingOpenDate: string; 

  @Column({ name: 'commenting_closed_date', type: 'date'})
  commentingClosedDate: string; 

  @Column({ name: 'geometry_latlong', type: 'geometry', spatialFeatureType: 'Point', srid: 4326 })
  geojson: FomPoint;

  @Column({ name: 'fsp_id'})
  fspId: number;

  @Column({ name: 'woodlot_license_number'})
  woodlotLicenseNumber: string;

  @ManyToOne(() => District)
  @JoinColumn({ name: 'district_id', referencedColumnName: 'id' })
  district: District;

  @Column({ name: 'district_id'})
  @RelationId((project: Project) => project.district)
  districtId: number;

  @ManyToOne(() => ForestClient)
  @JoinColumn({ name: 'forest_client_number', referencedColumnName: 'id' })
  forestClient: ForestClient;

  @Column({ name: 'forest_client_number'})
  @RelationId((project: Project) => project.forestClient)
  forestClientId: string;

  @ManyToOne(() => WorkflowStateCode)
  @JoinColumn({ name: 'workflow_state_code' })
  workflowState: WorkflowStateCode;

  @Column({ name: 'workflow_state_code'})
  @RelationId((project: Project) => project.workflowState)
  workflowStateCode: string;

  @ManyToOne(() => ProjectPlanCode)
  @JoinColumn({ name: 'project_plan_code', referencedColumnName: 'code' })
  projectPlan: ProjectPlanCode;

  @Column({ name: 'project_plan_code'})
  @RelationId((project: Project) => project.projectPlan)
  projectPlanCode: string;

  @OneToMany((_type) => CutBlock, (cutBlock) => cutBlock.project, {
    cascade: true,
  })
  cutBlocks: CutBlock[];

  @OneToMany((_type) => RoadSection, (roadSection) => roadSection.project, {
    cascade: true,
  })
  roadSections: RoadSection[];

  @OneToMany((_type) => Submission, (submission) => submission.project) 
  submissions: Submission[];
  
  @Column({ name: 'comment_classification_mandatory', default: true, nullable: false})
  commentClassificationMandatory: boolean;
  
  @OneToMany((_type) => PublicNotice, (publicNotice) => publicNotice.project, {cascade: true}) 
  publicNotices: PublicNotice[];

  @Column({ name: 'operation_start_year'})
  operationStartYear: number;

  @Column({ name: 'operation_end_year'})
  operationEndYear: number;
  
  @Column({ name: 'bcts_manager_name'})
  bctsMgrName: string;
}
