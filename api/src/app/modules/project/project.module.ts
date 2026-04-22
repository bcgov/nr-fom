import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProjectController } from './project.controller';
import { Project } from './project.entity';
import { ProjectService } from './project.service';

import { PublicNotice } from './public-notice.entity';
import { CutBlock } from '../submission/cut-block.entity';
import { RoadSection } from '../submission/road-section.entity';

import { MailModule } from '@api-core/mail/mail.module';
import { SecurityModule } from '@api-core/security/security.module';
import { AttachmentModule } from '@api-modules/attachment/attachment.module';
import { ProjectPlanCode } from '@src/app/modules/project/project-plan-code.entity';
import { DistrictModule } from '../district/district.module';
import { ForestClientModule } from '../forest-client/forest-client.module';
import { PublicCommentModule } from '../public-comment/public-comment.module';
import { ProjectAuthService } from './project-auth.service';
import { PublicNoticeController } from './public-notice.controller';
import { PublicNoticeService } from './public-notice.service';
import { WorkflowStateCodeController } from './workflow-state-code.controller';
import { WorkflowStateCode } from './workflow-state-code.entity';
import { WorkflowStateCodeService } from './workflow-state-code.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, WorkflowStateCode, PublicNotice, ProjectPlanCode, CutBlock, RoadSection]),
    DistrictModule,
    ForestClientModule,
    SecurityModule,
    AttachmentModule,
    PublicCommentModule,
    MailModule
  ],
  controllers: [ProjectController, PublicNoticeController, WorkflowStateCodeController],
  providers: [ProjectService, ProjectAuthService, PublicNoticeService, WorkflowStateCodeService],
  exports: [ProjectService, ProjectAuthService],
})
export class ProjectModule {}
