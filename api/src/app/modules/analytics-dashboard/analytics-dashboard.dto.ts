import { ApiProperty } from '@nestjs/swagger';
import { IsISODateOnlyString } from '@api-modules/interaction/interaction.dto';
import { DateTimeUtil } from '@api-core/dateTimeUtil';

export class DateRangeRequest {
  @ApiProperty({ description: 'Start date in YYYY-MM-DD format' })
  @IsISODateOnlyString({message: `"$property" must be ISO-formatted date. (Required format: ${DateTimeUtil.DATE_FORMAT})`})
  startDate: string;

  @ApiProperty({ description: 'End date in YYYY-MM-DD format' })
  @IsISODateOnlyString({message: `"$property" must be ISO-formatted date. (Required format: ${DateTimeUtil.DATE_FORMAT})`})
  endDate: string;
}
