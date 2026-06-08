import { ApiProperty } from '@nestjs/swagger';
import { ApiBaseEntity } from '@entities';
import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('forest_client', {schema: 'app_fom'})
export class ForestClient extends ApiBaseEntity<ForestClient> {
  constructor(forestClient?: Partial<ForestClient>) {
    super(forestClient);
  }

  @ApiProperty()
  @PrimaryColumn({name: 'forest_client_number'})
  public id!: string;

  @ApiProperty()
  @Column()
  name!: string;


}
