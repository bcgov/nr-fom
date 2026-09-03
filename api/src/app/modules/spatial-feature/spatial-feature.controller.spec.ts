import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@src/core/security/auth.guard';
import { User } from '@utility/security/user';
import { PinoLogger } from 'nestjs-pino';
import { SpatialFeatureController } from './spatial-feature.controller';
import { SpatialFeatureService } from './spatial-feature.service';

describe('SpatialFeatureController', () => {
  let controller: SpatialFeatureController;
  let service: Partial<SpatialFeatureService>;

  beforeEach(async () => {
    service = {
      findByProjectId: jest.fn().mockResolvedValue([]),
      getBcgwExtract: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SpatialFeatureController],
      providers: [
        { provide: SpatialFeatureService, useValue: service },
        { provide: PinoLogger, useValue: { info: jest.fn(), debug: jest.fn(), setContext: jest.fn() } },
        Reflector,
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<SpatialFeatureController>(SpatialFeatureController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should apply AuthGuard at the controller level', () => {
    const guards = Reflect.getMetadata('__guards__', SpatialFeatureController);
    expect(guards).toBeDefined();
    const hasAuthGuard = guards?.some(
      (g: any) => g === AuthGuard || g?.name === 'AuthGuard'
    );
    expect(hasAuthGuard).toBe(true);
  });

  it('getForProject forwards projectId and user to service', async () => {
    const user = new User();
    await controller.getForProject(user, 42);

    expect(service.findByProjectId).toHaveBeenCalledWith(42, user);
  });
});
