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
  let logger: { info: jest.Mock; debug: jest.Mock; setContext: jest.Mock };

  beforeEach(async () => {
    service = {
      findByProjectId: jest.fn().mockResolvedValue([]),
      streamBcgwExtract: jest.fn().mockResolvedValue(0),
    };
    logger = { info: jest.fn(), debug: jest.fn(), setContext: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SpatialFeatureController],
      providers: [
        { provide: SpatialFeatureService, useValue: service },
        { provide: PinoLogger, useValue: logger },
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

  it('getBcgwExtract rejects an invalid version without streaming', async () => {
    const res = { headersSent: false, destroy: jest.fn() } as any;

    await expect(controller.getBcgwExtract('nope', res)).rejects.toThrow('Invalid version');
    expect(service.streamBcgwExtract).not.toHaveBeenCalled();
  });

  it('getBcgwExtract streams when version is 1.0-final', async () => {
    const res = { headersSent: false, destroy: jest.fn(), setHeader: jest.fn() } as any;
    (service.streamBcgwExtract as jest.Mock).mockResolvedValue(3);

    await controller.getBcgwExtract('1.0-final', res);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/json; charset=utf-8');
    expect(service.streamBcgwExtract).toHaveBeenCalledWith(res);
    expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(/features=3/));
  });
});
