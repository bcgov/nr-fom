import { ApiProperty } from '@nestjs/swagger';

export class ForestClientResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}
