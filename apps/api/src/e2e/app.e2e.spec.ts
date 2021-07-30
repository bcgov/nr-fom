import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app/app.module';
import { KeycloakConfig } from '../core/security/auth.service';
import { User } from "@api-core/security/user";
import { ProjectResponse } from '../app/modules/project/project.dto';
import { LoggerModule } from 'nestjs-pino';
import { createFakeMinistryUser, createFakeForestryUser } from '../core/security/mock-user.factory';
import { SpatialFeatureBcgwResponse } from '../app/modules/spatial-feature/spatial-feature.dto';

process.env.KEYCLOAK_ENABLED="false"; // Necessary in order for authentication to succeed.

const httpGetFunction = (app) => async ( user: User, args: string ) => {
  if (user == null) {
    return await request(app.getHttpServer()).get(args);
  } else {
    return await request(app.getHttpServer()).get(args).set('Authorization', 'Bearer ' + JSON.stringify(user) );
  }
};

describe('API endpoints testing (e2e)', () => {
  let app: INestApplication;
  let httpGet;

  beforeAll(async () => {

    // Disable info logging to reduce noise during testing. Ideally set LOG_LEVEL environment variable to warn. (setting this above didn't work for unknown reason)
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, LoggerModule.forRoot({
        pinoHttp: { level: 'warn' },
      })],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableShutdownHooks();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true}));

    await app.init();

    httpGet = httpGetFunction(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth Endpoint', () => {
    // Testing of other endpoints is based on keycloak being disabled.
    it('should have keycloak disabled', async () => {
      const res = await request(app.getHttpServer()).get('/keycloakConfig');
      const config = res.body as KeycloakConfig;
      expect(config.enabled).toBe(false);
    });
  });

  describe('Project Endpoint', () => {
    it('get /project should return a list of projects', async () => {
      const user: User = createFakeMinistryUser();
      const res = await httpGet(user, '/project');
      expect(res.status).toBe(200);
      const result:ProjectResponse[] = res.body as ProjectResponse[];
      // Expect projects to be returned.
      expect(result.length).toBeGreaterThan(0);
    });
  });

  
  describe('Forest-client Endpoint', () => {
    it('get /forest-client with non-existant id should return HTTP 400 bad request', async () => {
      const user: User = createFakeForestryUser();
      const res = await httpGet(user, '/forest-client/-1');
      expect(res.status).toBe(400);
    });
  });
  
  describe('Spatial-feature Endpoint', () => {
    it('get /spatial-feature/bcgw-extract with valid version should return well-formed spatial response', async () => {

      const res = await httpGet(null, '/spatial-feature/bcgw-extract?version=1.0-final');
      expect(res.status).toBe(200);
      const result = res.body as SpatialFeatureBcgwResponse[];
      result.forEach(feature => {
        expect(feature.createDate).toBeDefined();
        expect(feature.featureId).toBeDefined();
        expect(feature.featureType).toBeDefined();
        expect(feature.fomId).toBeDefined();
        expect(feature.fspHolderName).toBeDefined();
        expect(feature.lifecycleStatus).toBeDefined();
        expect(feature.geometry).toBeDefined();
        expect(feature.geometry['type']).toBeDefined();
        expect(feature.geometry['coordinates']).toBeDefined();

        if (feature.featureType == 'cut_block') {
          expect(feature.geometry['type']).toBe('Polygon');
          expect(feature.plannedAreaHa).toBeDefined();
          expect(feature.plannedLengthKm).toBeUndefined();
        } else if (feature.featureType == 'retention_area') {
          expect(feature.geometry['type']).toBe('Polygon');
          expect(feature.plannedAreaHa).toBeDefined();
          expect(feature.plannedLengthKm).toBeUndefined();
          expect(feature.plannedDevelopmentDate).toBeUndefined();
        } else if (feature.featureType == 'road_section') {
          expect(feature.geometry['type']).toBe('LineString');
          expect(feature.plannedAreaHa).toBeUndefined();
          expect(feature.plannedLengthKm).toBeDefined();
        } else {
          expect(false).toBeTruthy(); // Unrecognized feature type
        }
      });
    });
  });
  
});
