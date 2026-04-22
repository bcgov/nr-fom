import { ApiBaseEntity } from '@entities';
import { Entity, PrimaryGeneratedColumn, JoinColumn, Column, ManyToOne, OneToMany, RelationId } from 'typeorm';

import { SubmissionTypeCode } from './submission-type-code.entity';
import { CutBlock } from './cut-block.entity';
import { RetentionArea } from './retention-area.entity';
import { RoadSection } from './road-section.entity';
import { Project } from '../project/project.entity';

@Entity('submission', {schema: 'app_fom'})
export class Submission extends ApiBaseEntity<Submission> {
  constructor(submission?: Partial<Submission>) {
    super(submission);
  }

  @PrimaryGeneratedColumn('increment', {name: 'submission_id'})
  public id: number;

  @Column({name: 'project_id'})
  projectId: number;

  @ManyToOne((_type) => Project, project => project.submissions)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => SubmissionTypeCode)
  @JoinColumn({ name: 'submission_type_code', referencedColumnName: 'code' })
  submissionType: SubmissionTypeCode;

  @Column({ name: 'submission_type_code'})
  @RelationId((submission: Submission) => submission.submissionType)
  submissionTypeCode: string;

  @OneToMany(_type => CutBlock, (cutBlock) => cutBlock.submission, {cascade: true})
  cutBlocks: CutBlock[];

  @OneToMany(_type => RetentionArea, (retentionArea) => retentionArea.submission, {cascade: true})
  retentionAreas: RetentionArea[];

  @OneToMany(_type => RoadSection, (roadSection) => roadSection.submission, {cascade: true})
  roadSections: RoadSection[];
}
