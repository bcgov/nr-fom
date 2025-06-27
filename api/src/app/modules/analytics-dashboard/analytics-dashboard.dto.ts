import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class DateRangeRequest {
  @ApiProperty({ description: 'Start date in YYYY-MM-DD format' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date in YYYY-MM-DD format' })
  @IsDateString()
  endDate: string;
}
