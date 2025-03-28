import { AppConfigService } from '@api-modules/app-config/app-config.provider';
import { ForestClientService } from '@api-modules/forest-client/forest-client.service';
import { ProjectService } from '@api-modules/project/project.service';
import { PublicNoticeService } from '@api-modules/project/public-notice.service';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { BatchJobEnum } from '@src/app-constants';
import 'dotenv/config';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { ConnectionOptions, createConnection } from 'typeorm';
import { AppModule } from './app/app.module';
import * as ormConfigMain from './migrations/ormconfig-migration-main';
import * as ormConfigTest from './migrations/ormconfig-migration-test';

async function dbmigrate(config: ConnectionOptions) {
    const connection = await createConnection(config);
    try {
      await connection.runMigrations({ transaction: "each"});
    } finally {
      await connection.close();
    }
}

async function createApp():Promise<INestApplication>  {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useLogger(app.get(Logger));
  return app;
}

async function bootstrap():Promise<INestApplication> {

  try {
    console.log("Running DB Main Migrations...");
    await dbmigrate(ormConfigMain as ConnectionOptions);
    console.log("Done DB Migrations.");
  } catch (error) {
    console.error('Error during database migration: ' + JSON.stringify(error));
    return null;
  }

  // Log heap
  console.log(v8.getHeapStatistics());
  
  const app = await createApp();

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Strips unknown properties not listed in input DTOs.
  }));
  const appConfig:AppConfigService = app.get(AppConfigService);
  app.setGlobalPrefix(appConfig.getGlobalPrefix());
  // Required setting as per https://stackoverflow.com/questions/52783959/nest-js-request-entity-too-large-payloadtoolargeerror-request-entity-too-larg
  const MAX_CONTENT_LIMIT = '30mb'
  app.use(json({ limit: MAX_CONTENT_LIMIT }));
  app.use(urlencoded({ extended: true, limit: MAX_CONTENT_LIMIT }));

  if (process.env.BYPASS_CORS === "true") {
    // For local development only; should set env var to 'false' within OpenShift deployments.
    app.enableCors({
      origin: '*',
      credentials: false,
    });
    console.log("CORS bypassed.");
  }

  const httpAdapter = app.getHttpAdapter().getInstance();
  httpAdapter.disable("x-powered-by");
  httpAdapter.use(helmet({ 
    crossOriginResourcePolicy: true, 
    crossOriginOpenerPolicy: true,
    crossOriginEmbedderPolicy: true,
    originAgentCluster: false,
    contentSecurityPolicy: true
  }));

  let cacheMiddleware = (_req, res, next) => {
    // Disable caching entirely by default for all APIs.
    res.set('Cache-control', 'no-store, max-age=0');
    res.set('Pragma', 'no-cache');
    next();
  }
  httpAdapter.use(cacheMiddleware);

  // Only meant for running locally, not accessible via /api route.
  httpAdapter.get('/health-check', (_req, res) => {
    res.send('Health check passed');
  });

  const config = new DocumentBuilder()
    .setTitle('FOM API')
    .setDescription('API for FOM backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const port = appConfig.getPort();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(appConfig.getGlobalPrefix(), app, document);

  await app.listen(port, () => {
    app.get(Logger).log('Listening at http://localhost:' + port + '/' + appConfig.getGlobalPrefix());
  });

  return app;
}

async function runTestDataMigrations(app: INestApplication) {
  if (process.env.DB_TESTDATA  == "true") {
    const logger = app.get(Logger);
    logger.log("Running DB Test Data Migrations...");
    // Need different name from default connection that is already active.
    // We don't change ormConfigTest's actual definition because when run via 'npm run' needs to use default connection.
    ormConfigTest['name'] = 'test-migration'; 
    await dbmigrate(ormConfigTest as ConnectionOptions);
  }
}

async function postStartup(app: INestApplication) {
  try {
    const logger = app.get(Logger);
    logger.log("Starting postStartup...");

    await runTestDataMigrations(app);

    // Preload cache for public summary default data.
    logger.log("Starting public summary cache pre-load...");
    await app.get(ProjectService).refreshCache();

    logger.log("Starting public notices cache pre-load...");
    await app.get(PublicNoticeService).refreshCache();

    logger.log("Done postStartup.");
  } catch (error) {
    console.error('Error during post startup: ' + JSON.stringify(error));
  }
}

async function startApi() {
  try {
    const app = await bootstrap();
    app.get(Logger).log("Done regular startup.");
    // Don't await so non-blocking - allows OpenShift container (pod) to be marked ready for traffic.
    postStartup(app).catch((postError) => {
      console.error('Error during post startup: ' + JSON.stringify(postError));
    });
  } catch (error) {
    console.error('Error during application startup: ' + JSON.stringify(error));
    process.exit(1);
  }  
}

async function runBatch(batchType: string) {
  try {
    const app = await createApp();
    app.get(Logger).log("Done startup.");
    if (batchType == BatchJobEnum.WorkFlowStateChange)
        await app.get(ProjectService).batchDateBasedWorkflowStateChange();
    else if (batchType == BatchJobEnum.ForestClientDataRefresh) {
        await app.get(ForestClientService).batchClientDataRefresh();
    }
    process.exit(0);
  } catch (error) {
    console.error('Error during batch execution: ' + JSON.stringify(error));
    process.exit(1);
  }  
}

async function standaloneRunTestDataMigrations() {
  try {
    const app = await createApp();
    const logger = app.get(Logger);
    logger.log("Done startup.");
    await runTestDataMigrations(app);

  } catch (error) {
    console.error('Error during test data migration: ' + JSON.stringify(error));
    process.exit(1);
  }
}

if (process.argv.length > 2 &&
    (BatchJobEnum.WorkFlowStateChange == process.argv[2] || 
        BatchJobEnum.ForestClientDataRefresh == process.argv[2]
    )) 
{
  console.log("Running batch process at " + new Date().toISOString() + " ...");
  runBatch(process.argv[2]);
} else if (process.argv.length > 2 && '-testdata' == process.argv[2]) {
  // Due to long delays running test migrations during normal startup, this provides a way to run them out-of-band, via an OpenShift batch job.
  console.log("Running test data migrations at " + new Date().toISOString() + " ...");
  standaloneRunTestDataMigrations();
} else {
  startApi();
}
