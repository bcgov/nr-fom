import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from '@dto';

export class RoadSectionDto extends BaseDto {
  @ApiProperty()
  geometry: any;
  @ApiProperty()
  plannedDevelopmentDate: string; // timestamp
  @ApiProperty()
  name: string;

  @ApiProperty()
  plannedLengthKm: number;
  // Relationships
  @ApiProperty()
  submissionId: number;
}
