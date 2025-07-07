import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

// Core Modules
import { AttachmentModule } from './modules/attachment/attachment.module';
import { AnalyticsDashboardModule } from './modules/analytics-dashboard/analytics-dashboard.module';
import { DistrictModule } from './modules/district/district.module';
import { ForestClientModule } from './modules/forest-client/forest-client.module';
import { InteractionModule } from './modules/interaction/interaction.module';
import { ProjectAuthModule } from './modules/project/project-auth.module';
import { ProjectModule } from './modules/project/project.module';
import { PublicCommentModule } from './modules/public-comment/public-comment.module';
import { SpatialFeatureModule } from './modules/spatial-feature/spatial-feature.module';
import { SubmissionModule } from './modules/submission/submission.module';

// Other Modules
import { ExternalModule } from '@src/app/modules/external/external.module';
import { LoggerModule } from 'nestjs-pino';
import { SecurityModule } from '../core/security/security.module';
import { AppConfigModule } from './modules/app-config/app-config.module';
import { AppConfigService } from './modules/app-config/app-config.provider';

function getLogLevel():string {
  return process.env.LOG_LEVEL || 'info';
}

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // Config
    AppConfigModule,
    SecurityModule,
    LoggerModule.forRoot({ pinoHttp: {
        level: getLogLevel(),
        timestamp: () => { 
          const time = new Date().toISOString();
          return `,"time": ${time}`;
        },
        formatters: {
          level: (label) => { return { level: label }; }
        }
      }}),
    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule],
      useFactory: (configService: AppConfigService) => ({
        autoLoadEntities: true,
        type: configService.db('type'),
        username: configService.db('username'),
        password: configService.db('password'),
        database: configService.db('database'),
        host: configService.db('host'),
        entities: configService.db('entities'),
        synchronize: configService.db('synchronize'),
        ssl: configService.db('ssl'),
        useUnifiedTopology: true,
        useNewUrlParser: true,
      }),
      inject: [AppConfigService],
    }),
    // Core Modules
    AttachmentModule,
    InteractionModule,
    AnalyticsDashboardModule,
    DistrictModule,
    ForestClientModule,
    ProjectModule,
    ProjectAuthModule,
    PublicCommentModule,
    SubmissionModule,
    SpatialFeatureModule,
    ExternalModule
  ],
})

export class AppModule {
  constructor(private appConfigService: AppConfigService) {}
}