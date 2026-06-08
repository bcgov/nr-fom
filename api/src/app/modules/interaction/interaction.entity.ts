import { ApiBaseEntity } from '@entities';
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('interaction', {schema: 'app_fom'})
export class Interaction extends ApiBaseEntity<Interaction> {
  constructor(interaction?: Partial<Interaction>) {
    super(interaction);
  }

  @PrimaryGeneratedColumn('increment', {name: 'interaction_id'})
  public id!: number;

  @Column()
  stakeholder!: string;

  @Column({ name: 'communication_date', type: 'date'})
  communicationDate!: string; // timestamp

  @Column({ name: 'communication_details'})
  communicationDetails!: string;

  @Column({ name: 'project_id'})
  projectId!: number;

  @Column({ name: 'attachment_id'})
  attachmentId!: number;
}
