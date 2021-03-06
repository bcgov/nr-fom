import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Project } from './project.entity';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';

import { PublicNotice } from './public-notice.entity';

import { DistrictModule } from '../district/district.module';
import { ForestClientModule } from '../forest-client/forest-client.module';
import { SecurityModule } from '@api-core/security/security.module';
import { WorkflowStateCodeController } from './workflow-state-code.controller';
import { WorkflowStateCodeService } from './workflow-state-code.service';
import { WorkflowStateCode } from './workflow-state-code.entity';
import { ProjectAuthService } from './project-auth.service';
import { PublicNoticeService } from './public-notice.service';
import { PublicNoticeController } from './public-notice.controller';
import { AttachmentModule } from '@api-modules/attachment/attachment.module';
import { PublicCommentModule } from '../public-comment/public-comment.module';
import { MailModule } from '@api-core/mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, WorkflowStateCode, PublicNotice]),
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
