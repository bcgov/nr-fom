import { Module } from '@nestjs/common';
import { AnalyticsDashboardController } from '@api-modules/analytics-dashboard/analytics-dashboard.controller';
import { ProjectModule } from '@api-modules/project/project.module';
import { PublicCommentModule } from '@api-modules/public-comment/public-comment.module';
import { SecurityModule } from '@api-core/security/security.module';

@Module({
  imports: [ProjectModule, PublicCommentModule, SecurityModule],
  controllers: [AnalyticsDashboardController],
})
export class AnalyticsDashboardModule {}
