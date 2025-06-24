// dashboard-query.dto.ts
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class DateRangeQueryDto {
  @ApiProperty({ description: 'Start date in YYYY-MM-DD format' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ description: 'End date in YYYY-MM-DD format' })
  @IsDateString()
  endDate: string;
}
