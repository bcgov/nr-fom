import { Module } from '@nestjs/common';
import { AnalyticsDashboardController } from './analytics-dashboard.controller';
import { AnalyticsDashboardService } from './analytics-dashboard.service';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [ProjectModule],
  controllers: [AnalyticsDashboardController],
  providers: [AnalyticsDashboardService],
})
export class AnalyticsDashboardModule {}
