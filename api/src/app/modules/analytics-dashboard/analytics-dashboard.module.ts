import { Module } from '@nestjs/common';
import { AnalyticsDashboardController } from '@api-modules/analytics-dashboard/analytics-dashboard.controller';
import { AnalyticsDashboardService } from '@api-modules/analytics-dashboard/analytics-dashboard.service';
import { ProjectModule } from '@api-modules/project/project.module';
import { PublicCommentModule } from '@api-modules/public-comment/public-comment.module';

@Module({
  imports: [ProjectModule, PublicCommentModule],
  controllers: [AnalyticsDashboardController],
  providers: [AnalyticsDashboardService],
})
export class AnalyticsDashboardModule {}
