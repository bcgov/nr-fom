import { DateTimeUtil } from '@api-core/dateTimeUtil';
import { IsISODateOnlyString } from '@api-modules/interaction/interaction.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ProjectPlanCodeFilterEnum } from './analytics-dashboard-data-filter';

export class AnalyticsDashboarQuaryRequest {
  @ApiProperty({ description: 'Start date in YYYY-MM-DD format' })
  @IsISODateOnlyString({message: `"$property" must be ISO-formatted date. (Required format: ${DateTimeUtil.DATE_FORMAT})`})
  startDate: string;

  @ApiProperty({ description: 'End date in YYYY-MM-DD format' })
  @IsISODateOnlyString({message: `"$property" must be ISO-formatted date. (Required format: ${DateTimeUtil.DATE_FORMAT})`})
  endDate: string;

  @ApiProperty({
    description: 'Project plan code filter (FSP, WOODLOT, ALL). Default to FSP',
    enum: ProjectPlanCodeFilterEnum,
    enumName: 'ProjectPlanCodeFilterEnum',
    required: false,
    default: ProjectPlanCodeFilterEnum.FSP,
  })
  @IsEnum(ProjectPlanCodeFilterEnum)
  projectPlanCode: ProjectPlanCodeFilterEnum = ProjectPlanCodeFilterEnum.FSP;
}
