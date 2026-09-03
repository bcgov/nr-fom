import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '@utility/security/user';
import { PinoLogger } from 'nestjs-pino';
import { Repository } from 'typeorm';
import { ProjectService } from '../project/project.service';
import { SpatialFeature } from './spatial-feature.entity';
import { SpatialFeatureService } from './spatial-feature.service';

describe('SpatialFeatureService', () => {
  let service: SpatialFeatureService;
  let spatialFeatureRepository: Partial<Repository<SpatialFeature>>;
  let projectService: Partial<ProjectService>;

  beforeEach(async () => {
    spatialFeatureRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    projectService = {
      findOne: jest.fn().mockResolvedValue({ id: 1 } as any),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpatialFeatureService,
        { provide: getRepositoryToken(SpatialFeature), useValue: spatialFeatureRepository },
        { provide: ProjectService, useValue: projectService },
        { provide: PinoLogger, useValue: { debug: jest.fn(), setContext: jest.fn(), info: jest.fn() } },
      ],
    }).compile();

    service = module.get<SpatialFeatureService>(SpatialFeatureService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByProjectId', () => {
    it('should call projectService.findOne to authorize access and return features', async () => {
      const mockFeature = new SpatialFeature();
      mockFeature.featureId = 10;
      mockFeature.featureType = 'cut_block';
      mockFeature.centroid = '{"type":"Point","coordinates":[0,0]}';
      mockFeature.geometry = '{"type":"Polygon","coordinates":[[[0,0],[0,1],[1,1],[0,0]]]}';
      (spatialFeatureRepository.find as jest.Mock).mockResolvedValue([mockFeature]);

      const user = new User();
      const result = await service.findByProjectId(1, user);

      expect(projectService.findOne).toHaveBeenCalledWith(1, user);
      expect(spatialFeatureRepository.find).toHaveBeenCalledWith({
        where: { projectId: 1 },
        relations: { submissionType: true },
      });
      expect(result).toHaveLength(1);
      expect(result[0].featureId).toBe(10);
    });

    it('should throw ForbiddenException if projectService.findOne rejects with ForbiddenException', async () => {
      (projectService.findOne as jest.Mock).mockRejectedValue(new ForbiddenException());

      await expect(service.findByProjectId(1, null)).rejects.toThrow(ForbiddenException);
      expect(spatialFeatureRepository.find).not.toHaveBeenCalled();
    });

    it('should propagate BadRequestException if project is not found', async () => {
      (projectService.findOne as jest.Mock).mockRejectedValue(new BadRequestException('No entity for the specified id.'));

      await expect(service.findByProjectId(999, null)).rejects.toThrow(BadRequestException);
      expect(spatialFeatureRepository.find).not.toHaveBeenCalled();
    });
  });
});
