import { ApiBaseEntity } from '@entities';
import {
  Entity,
  PrimaryGeneratedColumn,
  JoinColumn,
  Column,
  ManyToOne,
  RelationId,
} from 'typeorm';
import { ResponseCode } from './response-code.entity';
import { CommentScopeCode } from './comment-scope-code.entity';
import { CutBlock } from '../submission/cut-block.entity';
import { RoadSection } from '../submission/road-section.entity';
import { Project } from '../project/project.entity';

@Entity('public_comment', { schema: 'app_fom' })
export class PublicComment extends ApiBaseEntity<PublicComment> {
  constructor(project?: Partial<PublicComment>) {
    super(project);
  }

  @PrimaryGeneratedColumn('increment', { name: 'public_comment_id' })
  public id: number;

  @Column()
  feedback: string;

  @Column()
  name: string;

  @Column()
  location: string;

  @Column()
  email: string;

  @Column({ name: 'phone_number'})
  phoneNumber: string;

  @Column({ name: 'response_details'})
  responseDetails: string;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id', referencedColumnName: 'id' })
  project: Project;

  @Column({ name: 'project_id'})
  projectId: number;

  @ManyToOne(() => ResponseCode)
  @JoinColumn({ name: 'response_code', referencedColumnName: 'code' })
  response: ResponseCode;

  @Column({ name: 'response_code'})
  @RelationId((comment: PublicComment) => comment.response)
  responseCode: string;

  @ManyToOne(() => CommentScopeCode)
  @JoinColumn({ name: 'comment_scope_code', referencedColumnName: 'code' })
  commentScope: CommentScopeCode;

  @Column({ name: 'comment_scope_code'})
  @RelationId((comment: PublicComment) => comment.commentScope)
  commentScopeCode: string;

  @Column({ name: 'scope_cut_block_id'})
  @RelationId((comment: PublicComment) => comment.cutBlock)
  scopeCutBlockId: number;

  @ManyToOne(() => CutBlock)
  @JoinColumn({ name: 'scope_cut_block_id', referencedColumnName: 'id' })
  cutBlock: CutBlock;

  @Column({ name: 'scope_road_section_id'})
  @RelationId((comment: PublicComment) => comment.roadSection)
  scopeRoadSectionId: number;

  @ManyToOne(() => RoadSection)
  @JoinColumn({ name: 'scope_road_section_id', referencedColumnName: 'id' })
  roadSection: RoadSection;
}
