import { ApiBaseEntity } from '@entities';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { Submission } from './submission.entity';

@Entity(RetentionArea.tableName, {schema: 'app_fom'})
export class RetentionArea extends ApiBaseEntity<RetentionArea> {

  static readonly tableName = 'retention_area';

  constructor(retentionArea?: Partial<RetentionArea>) {
    super(retentionArea);
  }

  @PrimaryGeneratedColumn('increment', {name: 'retention_area_id'})
  public id!: number;

  @Column({ type: 'geometry', spatialFeatureType: 'Point', srid: 3005 })
  geometry!: any;

  @Column({ name: 'planned_area_ha'})
  plannedAreaHa?: number;

  @ManyToOne(() => Submission, (submission) => submission.retentionAreas, {onDelete: 'CASCADE', orphanedRowAction:'delete'})
  @JoinColumn({ name: 'submission_id', referencedColumnName: 'id' })
  submission?: Submission;

  @Column({ name: 'submission_id'})
  @RelationId((retentionArea: RetentionArea) => retentionArea.submission)
  submissionId!: number;
}
