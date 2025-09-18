import { AdminOperationGuard } from '@api-core/security/admin.guard';
import { ProjectService } from '@api-modules/project/project.service';
import { PublicCommentService } from '@api-modules/public-comment/public-comment.service';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@src/core/security/auth.guard';
import { PinoLogger } from 'nestjs-pino';
import { AnalyticsDashboardController } from './analytics-dashboard.controller';

describe('AnalyticsDashboardController - Guard Enforcement', () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      controllers: [AnalyticsDashboardController],
      providers: [
        { provide: ProjectService, useValue: {} },
        { provide: PublicCommentService, useValue: {} },
        { provide: PinoLogger, useValue: {} },
        Reflector,
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(AdminOperationGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();
  });

  it('should apply AdminOperationGuard at the controller level', () => {
    const guards = Reflect.getMetadata('__guards__', AnalyticsDashboardController);
    expect(guards).toBeDefined();
    const hasAdminGuard = guards?.some(
      (g: any) => g === AdminOperationGuard || g?.name === 'AdminOperationGuard'
    );
    expect(hasAdminGuard).toBe(true);
  });
});
