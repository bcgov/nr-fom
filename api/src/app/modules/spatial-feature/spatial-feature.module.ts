import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ForestClientModule } from '../forest-client/forest-client.module';
import { SubmissionModule } from '../submission/submission.module';
import { SpatialFeatureService } from './spatial-feature.service';
import { SpatialFeature } from './spatial-feature.entity';
import { SpatialFeatureController } from './spatial-feature.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SpatialFeature]),
    ForestClientModule,
    SubmissionModule,
  ],
  controllers: [SpatialFeatureController],
  providers: [SpatialFeatureService],
  exports: [],
})
export class SpatialFeatureModule {}
