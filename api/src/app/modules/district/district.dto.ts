import { ApiProperty } from '@nestjs/swagger';

export class DistrictResponse {
  @ApiProperty()
  public id!: number;

  @ApiProperty()
  name!: string;
}
