import { Test, TestingModule } from '@nestjs/testing';
import { SpatialFeatureService } from './spatial-feature.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SpatialFeature } from './spatial-feature.entity';
import { PinoLogger } from 'nestjs-pino';

describe('SpatialFeatureService', () => {
  let service: SpatialFeatureService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpatialFeatureService,
        { provide: getRepositoryToken(SpatialFeature), useValue: {} },
        { provide: PinoLogger, useValue: { debug: jest.fn(), setContext: jest.fn() } },
      ],
    }).compile();

    service = module.get<SpatialFeatureService>(SpatialFeatureService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Add more tests for service methods here
});
