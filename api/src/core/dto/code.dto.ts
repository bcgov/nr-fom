import { ApiProperty } from '@nestjs/swagger';

export class CodeDto {
  @ApiProperty()
  public code!: string;
  @ApiProperty()
  public description!: string;
}
