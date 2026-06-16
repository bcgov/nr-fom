import { ApiBaseEntity } from '@entities';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Project } from './project.entity';

@Entity('public_notice', {schema: 'app_fom'})
export class PublicNotice extends ApiBaseEntity<PublicNotice> {
  constructor(publicNotice?: Partial<PublicNotice>) {
    super(publicNotice);
  }

  @PrimaryGeneratedColumn('increment', {name: 'public_notice_id'})
  public id!: number;

  @Column({name: 'project_id'})
  projectId!: number;

  @ManyToOne(() => Project, (project) => project.publicNotices, {onDelete: 'CASCADE', orphanedRowAction:'delete'})
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @Column({name: 'review_address'})
  reviewAddress!: string;

  @Column({name: 'review_business_hours'})
  reviewBusinessHours!: string;

  @Column({name: 'is_receive_comments_same_as_review'})
  isReceiveCommentsSameAsReview!: boolean;

  @Column({ name: 'receive_comments_address'})
  receiveCommentsAddress?: string;

  @Column({ name: 'receive_comments_business_hours'})
  receiveCommentsBusinessHours?: string;

  @Column({ name: 'mailing_address'})
  mailingAddress!: string;

  @Column()
  email!: string;

  @Column({ name: 'post_date', type: 'date'})
  postDate?: string;
}
