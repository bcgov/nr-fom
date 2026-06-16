import { ApiBaseEntity } from '@entities';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId
} from 'typeorm';
import { Submission } from './submission.entity';

@Entity(RoadSection.tableName, { schema: 'app_fom' })
export class RoadSection extends ApiBaseEntity<RoadSection> {

  static readonly tableName = 'road_section';

  constructor(roadSection?: Partial<RoadSection>) {
    super(roadSection);
  }

  @PrimaryGeneratedColumn('increment', { name: 'road_section_id' })
  public id!: number;

  @Column({ type: 'geometry', spatialFeatureType: 'LineString', srid: 3005 })
  geometry!: any;

  @Column({ name: 'planned_development_date'})
  plannedDevelopmentDate!: string; // timestamp

  @Column()
  name?: string;

  @Column({ name: 'planned_length_km'})
  plannedLengthKm?: number;

  @ManyToOne(() => Submission, (submission) => submission.roadSections, {onDelete: 'CASCADE', orphanedRowAction:'delete'})
  @JoinColumn({ name: 'submission_id', referencedColumnName: 'id' })
  submission!: Submission;

  @Column({ name: 'submission_id'})
  @RelationId((roadSection: RoadSection) => roadSection.submission)
  submissionId!: number;
}
