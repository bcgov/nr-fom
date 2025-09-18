import { AdminOperationGuard } from '@api-core/security/admin.guard';
import { AuthGuard } from '@api-core/security/auth.guard';
import { ProjectService } from '@api-modules/project/project.service';
import { PublicCommentService } from '@api-modules/public-comment/public-comment.service';
import { ForbiddenException, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AuthService } from '@src/core/security/auth.service';
import { PinoLogger } from 'nestjs-pino';
import * as request from 'supertest';
import { AnalyticsDashboardController } from './analytics-dashboard.controller';

const mockProjectService = {
  getNonInitialPublishedProjectCountByDistrict: jest.fn().mockResolvedValue([]),
};
const mockPublicCommentService = {};

/*
Tests to ensure that the AdminOperationGuard is properly applied to the AnalyticsDashboardController.
 */
describe('AnalyticsDashboardController - AdminOperationGuard', () => {
  let app: INestApplication;
  let mockAdminGuardCanActivate: jest.Mock;

  beforeAll(async () => {
    mockAdminGuardCanActivate = jest.fn();

    const moduleRef = await Test.createTestingModule({
      controllers: [AnalyticsDashboardController],
      providers: [
        Reflector,
        PinoLogger,
        { provide: ProjectService, useValue: mockProjectService },
        { provide: PublicCommentService, useValue: mockPublicCommentService },
        { provide: AuthService, useValue: jest.fn() },
        { provide: 'pino-params', useValue: {} }
      ],
    })
      .overrideGuard(AuthGuard) // mock the AuthGuard to always allow access as we are testing AdminOperationGuard.
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminOperationGuard)
      .useValue({ canActivate: mockAdminGuardCanActivate })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should allow access when AdminOperationGuard allows', async () => {
    mockAdminGuardCanActivate.mockReturnValue(true);
    await request(app.getHttpServer())
      .get('/analytics-dashboard/project/count-by-district')
      .expect(200);
    expect(mockAdminGuardCanActivate).toHaveBeenCalled();
  });

  it('should deny access when AdminOperationGuard denies', async () => {
    mockAdminGuardCanActivate.mockImplementation(() => { throw new ForbiddenException(); });
    await request(app.getHttpServer())
      .get('/analytics-dashboard/project/count-by-district')
      .expect(403);
  });
});
