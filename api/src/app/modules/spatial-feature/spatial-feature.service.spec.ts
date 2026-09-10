import { BadRequestException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '@utility/security/user';
import { PinoLogger } from 'nestjs-pino';
import { PassThrough } from 'node:stream';
import { DataSource, In, Repository } from 'typeorm';
import { ProjectService } from '../project/project.service';
import { WorkflowStateEnum } from '../project/workflow-state-code.entity';
import { SpatialFeature } from './spatial-feature.entity';
import { BcgwExtractRow, SpatialFeatureService } from './spatial-feature.service';

describe('SpatialFeatureService', () => {
  let service: SpatialFeatureService;
  let spatialFeatureRepository: Partial<Repository<SpatialFeature>>;
  let projectService: Partial<ProjectService>;
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    query: jest.Mock;
    isTransactionActive: boolean;
  };

  beforeEach(async () => {
    spatialFeatureRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    projectService = {
      findOne: jest.fn().mockResolvedValue({ id: 1, forestClient: { id: '1011' } } as any),
    };
    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([]),
      isTransactionActive: true,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpatialFeatureService,
        { provide: getRepositoryToken(SpatialFeature), useValue: spatialFeatureRepository },
        { provide: ProjectService, useValue: projectService },
        { provide: DataSource, useValue: { createQueryRunner: () => queryRunner } },
        { provide: PinoLogger, useValue: { debug: jest.fn(), setContext: jest.fn(), info: jest.fn() } },
      ],
    }).compile();

    service = module.get<SpatialFeatureService>(SpatialFeatureService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByProjectId', () => {
    it('should filter by public workflow states for anonymous users', async () => {
      const mockFeature = new SpatialFeature();
      mockFeature.featureId = 10;
      mockFeature.featureType = 'cut_block';
      mockFeature.centroid = '{"type":"Point","coordinates":[0,0]}';
      mockFeature.geometry = '{"type":"Polygon","coordinates":[[[0,0],[0,1],[1,1],[0,0]]]}';
      (spatialFeatureRepository.find as jest.Mock).mockResolvedValue([mockFeature]);

      const result = await service.findByProjectId(1, null);

      expect(projectService.findOne).toHaveBeenCalledWith(1, null);
      expect(spatialFeatureRepository.find).toHaveBeenCalledWith({
        where: {
          projectId: 1,
          workflowStateCode: In([
            WorkflowStateEnum.COMMENT_OPEN,
            WorkflowStateEnum.COMMENT_CLOSED,
            WorkflowStateEnum.FINALIZED,
          ]),
        },
        relations: { submissionType: true },
      });
      expect(result).toHaveLength(1);
      expect(result[0].featureId).toBe(10);
    });

    it('should not restrict workflow states for ministry users', async () => {
      const user = new User();
      user.isMinistry = true;

      await service.findByProjectId(1, user);

      expect(projectService.findOne).toHaveBeenCalledWith(1, user);
      expect(spatialFeatureRepository.find).toHaveBeenCalledWith({
        where: { projectId: 1 },
        relations: { submissionType: true },
      });
    });

    it('should not restrict workflow states for authorized forest client users', async () => {
      const user = new User();
      user.isForestClient = true;
      user.clientIds.push('1011');

      await service.findByProjectId(1, user);

      expect(projectService.findOne).toHaveBeenCalledWith(1, user);
      expect(spatialFeatureRepository.find).toHaveBeenCalledWith({
        where: { projectId: 1 },
        relations: { submissionType: true },
      });
    });

    it('should restrict workflow states for unauthorized forest client users', async () => {
      const user = new User();
      user.isForestClient = true;
      user.clientIds.push('9999');

      await service.findByProjectId(1, user);

      expect(projectService.findOne).toHaveBeenCalledWith(1, user);
      expect(spatialFeatureRepository.find).toHaveBeenCalledWith({
        where: {
          projectId: 1,
          workflowStateCode: In([
            WorkflowStateEnum.COMMENT_OPEN,
            WorkflowStateEnum.COMMENT_CLOSED,
            WorkflowStateEnum.FINALIZED,
          ]),
        },
        relations: { submissionType: true },
      });
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

  describe('streamBcgwExtract', () => {
    function mockFetchBatches(batches: BcgwExtractRow[][]): void {
      let fetchIndex = 0;
      queryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.startsWith('FETCH')) {
          const batch = batches[fetchIndex] ?? [];
          fetchIndex += 1;
          return batch;
        }
        return undefined;
      });
    }

    async function collectJson(rows: BcgwExtractRow[]): Promise<unknown> {
      mockFetchBatches(rows.length ? [rows, []] : [[]]);
      const out = new PassThrough();
      const chunks: Buffer[] = [];
      out.on('data', (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      const ended = new Promise<void>((resolve) => out.on('finish', resolve));
      await service.streamBcgwExtract(out);
      await ended;
      return JSON.parse(Buffer.concat(chunks).toString());
    }

    it('writes an empty JSON array when there are no rows', async () => {
      expect(await collectJson([])).toEqual([]);
    });

    it('streams one feature at a time as a JSON array and omits unused measures', async () => {
      const body = await collectJson([
        {
          featureId: 10,
          featureType: 'cut_block',
          fomId: 42,
          name: 'CB-1',
          createTimestamp: '2026-01-02',
          geometry: '{"type":"Polygon","coordinates":[[[0,0],[0,1],[1,1],[0,0]]]}',
          plannedDevelopmentDate: '2026-03-01',
          plannedAreaHa: 1.5,
          plannedLengthKm: 0,
          fspHolderName: 'Acme',
          lifecycleStatus: 'Proposed',
        },
        {
          featureId: 11,
          featureType: 'road_section',
          fomId: 42,
          name: null,
          createTimestamp: '2026-01-03',
          geometry: '{"type":"LineString","coordinates":[[0,0],[1,1]]}',
          plannedDevelopmentDate: null,
          plannedAreaHa: null,
          plannedLengthKm: 2.25,
          fspHolderName: 'Acme',
          lifecycleStatus: 'Final',
        },
      ]);

      expect(body).toEqual([
        {
          createDate: '2026-01-02',
          featureId: 10,
          featureType: 'cut_block',
          fomId: 42,
          fspHolderName: 'Acme',
          geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] },
          lifecycleStatus: 'Proposed',
          name: 'CB-1',
          plannedAreaHa: 1.5,
          plannedDevelopmentDate: '2026-03-01',
        },
        {
          createDate: '2026-01-03',
          featureId: 11,
          featureType: 'road_section',
          fomId: 42,
          fspHolderName: 'Acme',
          geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
          lifecycleStatus: 'Final',
          name: '',
          plannedLengthKm: 2.25,
        },
      ]);
    });

    it('selects geojson only and filters public workflow states', async () => {
      await collectJson([]);

      const declareCall = queryRunner.query.mock.calls.find(
        (call: [string, unknown?]) => call[0].includes('DECLARE bcgw_extract'));
      expect(declareCall).toBeDefined();
      const sql: string = declareCall[0];
      const params: string[] = declareCall[1];
      expect(sql).toContain('f.geojson');
      expect(sql).not.toContain('centroid');
      expect(params).toEqual([
        WorkflowStateEnum.COMMENT_OPEN,
        WorkflowStateEnum.COMMENT_CLOSED,
        WorkflowStateEnum.FINALIZED,
      ]);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('releases the query runner when mapping a row fails', async () => {
      mockFetchBatches([[
        {
          featureId: 1,
          featureType: 'cut_block',
          fomId: 1,
          name: 'x',
          createTimestamp: '2026-01-01',
          geometry: null,
          plannedDevelopmentDate: null,
          plannedAreaHa: 1,
          plannedLengthKm: 0,
          fspHolderName: 'Acme',
          lifecycleStatus: 'Proposed',
        },
      ]]);

      const out = new PassThrough();
      await expect(service.streamBcgwExtract(out)).rejects.toThrow(InternalServerErrorException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });
  });
});

