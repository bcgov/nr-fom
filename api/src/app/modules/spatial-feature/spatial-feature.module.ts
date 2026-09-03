import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SecurityModule } from '@api-core/security/security.module';
import { ForestClientModule } from '../forest-client/forest-client.module';
import { ProjectModule } from '../project/project.module';
import { SubmissionModule } from '../submission/submission.module';
import { SpatialFeatureController } from './spatial-feature.controller';
import { SpatialFeature } from './spatial-feature.entity';
import { SpatialFeatureService } from './spatial-feature.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SpatialFeature]),
    ForestClientModule,
    SubmissionModule,
    ProjectModule,
    SecurityModule,
  ],
  controllers: [SpatialFeatureController],
  providers: [SpatialFeatureService],
  exports: [],
})
export class SpatialFeatureModule {}
