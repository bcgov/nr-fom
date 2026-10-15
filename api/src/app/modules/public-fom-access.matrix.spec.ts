import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '@utility/security/user';
import { PinoLogger } from 'nestjs-pino';
import { DataSource, Repository } from 'typeorm';
import { mockLoggerFactory } from '../factories/mock-logger.factory';
import { AttachmentTypeCode, AttachmentTypeEnum } from './attachment/attachment-type-code.entity';
import { Attachment } from './attachment/attachment.entity';
import { AttachmentService } from './attachment/attachment.service';
import { ProjectAuthService } from './project/project-auth.service';
import { Project } from './project/project.entity';
import { ProjectService } from './project/project.service';
import { WorkflowStateEnum } from './project/workflow-state-code.entity';
import { SpatialFeature } from './spatial-feature/spatial-feature.entity';
import { SpatialFeatureService } from './spatial-feature/spatial-feature.service';

describe('Public FOM access matrix', () => {
  const PROJECT_ID = 100;
  const ATTACHMENT_ID = 200;

  let projectService: ProjectService;
  let attachmentService: AttachmentService;
  let spatialService: SpatialFeatureService;
  let mockProjectAuthService: Partial<ProjectAuthService>;
  let mockAttachmentRepo: Partial<Repository<Attachment>>;
  let mockSpatialRepo: Partial<Repository<SpatialFeature>>;
  let mockProjectFindOne: jest.Mock;

  function ministryUser(): User {
    const user = new User();
    user.isMinistry = true;
    user.userName = 'admin';
    return user;
  }

  const actors: Array<{ label: 'signed-out' | 'public' | 'admin'; user: User | null | undefined }> = [
    { label: 'signed-out', user: undefined },
    { label: 'public', user: null },
    { label: 'admin', user: ministryUser() },
  ];

  beforeEach(async () => {
    projectService = new ProjectService(null, mockLoggerFactory(), null, null, null, null, null);

    mockAttachmentRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    mockProjectAuthService = {
      isForestClientUserAccess: jest.fn().mockResolvedValue(false),
      isAnonymousUserAllowedStateAccess: jest.fn(),
    };
    attachmentService = new AttachmentService(
      mockAttachmentRepo as Repository<Attachment>,
      mockLoggerFactory(),
      mockProjectAuthService as ProjectAuthService
    );

    mockSpatialRepo = { find: jest.fn().mockResolvedValue([]) };
    mockProjectFindOne = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpatialFeatureService,
        { provide: getRepositoryToken(SpatialFeature), useValue: mockSpatialRepo },
        { provide: ProjectService, useValue: { findOne: mockProjectFindOne } },
        { provide: DataSource, useValue: { createQueryRunner: () => ({}) } },
        {
          provide: PinoLogger,
          useValue: { debug: jest.fn(), setContext: jest.fn(), info: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();
    spatialService = module.get(SpatialFeatureService);
  });

  function projectEntity(state: WorkflowStateEnum): Project {
    const entity = new Project();
    entity.id = PROJECT_ID;
    entity.workflowStateCode = state;
    return entity;
  }

  function publicNoticeAttachment(): Attachment {
    const entity = new Attachment();
    entity.id = ATTACHMENT_ID;
    entity.projectId = PROJECT_ID;
    entity.fileName = 'notice.pdf';
    entity.attachmentType = { code: AttachmentTypeEnum.PUBLIC_NOTICE } as AttachmentTypeCode;
    return entity;
  }

  function mockAttachmentList(): void {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([publicNoticeAttachment()]),
    };
    (mockAttachmentRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);
  }

  describe.each([
    {
      fom: 'unpublished',
      state: WorkflowStateEnum.INITIAL,
      published: false,
      expectAllowed: { 'signed-out': false, public: false, admin: true } as const,
    },
    {
      fom: 'published',
      state: WorkflowStateEnum.COMMENT_OPEN,
      published: true,
      expectAllowed: { 'signed-out': true, public: true, admin: true } as const,
    },
  ])('$fom FOM', ({ state, published, expectAllowed }) => {
    describe.each(actors)('$label user', ({ label, user }) => {
      const allowed = () => expectAllowed[label];

      it('GET /api/project/:id', async () => {
        expect(await projectService.isViewAuthorized(projectEntity(state), user as any)).toBe(allowed());
      });

      it('GET /api/spatial-feature?projectId=', async () => {
        if (allowed()) {
          mockProjectFindOne.mockResolvedValue({ id: PROJECT_ID, forestClient: { id: '1011' } });
          await expect(spatialService.findByProjectId(PROJECT_ID, user as any)).resolves.toEqual([]);
          expect(mockProjectFindOne).toHaveBeenCalledWith(PROJECT_ID, user);
        } else {
          mockProjectFindOne.mockRejectedValue(new ForbiddenException());
          await expect(spatialService.findByProjectId(PROJECT_ID, user as any)).rejects.toThrow(ForbiddenException);
          expect(mockSpatialRepo.find).not.toHaveBeenCalled();
        }
      });

      it('GET /api/attachment?projectId=', async () => {
        (mockProjectAuthService.isAnonymousUserAllowedStateAccess as jest.Mock).mockResolvedValue(published);
        if (allowed()) {
          mockAttachmentList();
          await expect(
            attachmentService.findByProjectIdNoInteraction(PROJECT_ID, user as any)
          ).resolves.toHaveLength(1);
        } else {
          await expect(
            attachmentService.findByProjectIdNoInteraction(PROJECT_ID, user as any)
          ).rejects.toThrow(ForbiddenException);
        }
      });

      it('GET /api/attachment/file/:id', async () => {
        (mockProjectAuthService.isAnonymousUserAllowedStateAccess as jest.Mock).mockResolvedValue(published);
        expect(await attachmentService.isViewAuthorized(publicNoticeAttachment(), user as any)).toBe(allowed());
      });
    });
  });
});
