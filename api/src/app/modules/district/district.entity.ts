import { ApiBaseEntity } from '@entities';
import { ApiProperty } from '@nestjs/swagger';
import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('district', {schema: 'app_fom'})
export class District extends ApiBaseEntity<District> {
  constructor(district?: Partial<District>) {
    super(district);
  }

  @ApiProperty()
  @PrimaryColumn({name: 'district_id'})
  public id!: number;

  @ApiProperty()
  @Column()
  name!: string;

  @Column()
  email!: string;

}
