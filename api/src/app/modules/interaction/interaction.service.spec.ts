import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { User } from '@utility/security/user';
import { Repository } from 'typeorm';
import { mockLoggerFactory } from '../../factories/mock-logger.factory';
import { AttachmentResponse } from '../attachment/attachment.dto';
import { AttachmentService } from '../attachment/attachment.service';
import { ProjectAuthService } from '../project/project-auth.service';
import { ProjectResponse } from '../project/project.dto';
import { ProjectService } from '../project/project.service';
import { WorkflowStateEnum } from '../project/workflow-state-code.entity';
import { InteractionCreateRequest, InteractionResponse, InteractionUpdateRequest } from './interaction.dto';
import { Interaction } from './interaction.entity';
import { InteractionService } from './interaction.service';

describe('InteractionService', () => {
  let service: InteractionService;
  let mockRepository: Partial<Repository<Interaction>>;
  let mockProjectAuthService: Partial<ProjectAuthService>;
  let mockAttachmentService: Partial<AttachmentService>;
  let mockProjectService: Partial<ProjectService>;

  const TEST_PROJECT_ID = 100;
  const TEST_INTERACTION_ID = 50;
  const TEST_ATTACHMENT_ID = 25;

  beforeEach(() => {
    mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    mockProjectAuthService = {
      isForestClientUserAllowedStateAccess: jest.fn(),
      isForestClientUserAccess: jest.fn(),
    };

    mockAttachmentService = {
      create: jest.fn(),
      delete: jest.fn(),
      findOne: jest.fn(),
    };

    mockProjectService = {
      findOne: jest.fn(),
    };

    service = new InteractionService(
      mockRepository as Repository<Interaction>,
      mockLoggerFactory(),
      mockProjectAuthService as ProjectAuthService,
      mockAttachmentService as AttachmentService,
      mockProjectService as ProjectService
    );
  });

  describe('Authorization checks', () => {
    it('isCreateAuthorized checks COMMENT_OPEN and COMMENT_CLOSED states', async () => {
      const user = new User();
      const request = new InteractionCreateRequest();
      request.projectId = TEST_PROJECT_ID;

      (mockProjectAuthService.isForestClientUserAllowedStateAccess as jest.Mock).mockResolvedValue(true);

      const result = await service.isCreateAuthorized(request, user);

      expect(result).toBe(true);
      expect(mockProjectAuthService.isForestClientUserAllowedStateAccess).toHaveBeenCalledWith(
        TEST_PROJECT_ID,
        [WorkflowStateEnum.COMMENT_OPEN, WorkflowStateEnum.COMMENT_CLOSED],
        user
      );
    });

    it('isUpdateAuthorized checks COMMENT_OPEN and COMMENT_CLOSED states', async () => {
      const user = new User();
      const request = new InteractionCreateRequest();
      request.projectId = TEST_PROJECT_ID;

      (mockProjectAuthService.isForestClientUserAllowedStateAccess as jest.Mock).mockResolvedValue(true);

      const result = await service.isUpdateAuthorized(request, new Interaction(), user);

      expect(result).toBe(true);
      expect(mockProjectAuthService.isForestClientUserAllowedStateAccess).toHaveBeenCalledWith(
        TEST_PROJECT_ID,
        [WorkflowStateEnum.COMMENT_OPEN, WorkflowStateEnum.COMMENT_CLOSED],
        user
      );
    });

    it('isDeleteAuthorized checks COMMENT_OPEN and COMMENT_CLOSED states', async () => {
      const user = new User();
      const entity = new Interaction();
      entity.projectId = TEST_PROJECT_ID;

      (mockProjectAuthService.isForestClientUserAllowedStateAccess as jest.Mock).mockResolvedValue(true);

      const result = await service.isDeleteAuthorized(entity, user);

      expect(result).toBe(true);
      expect(mockProjectAuthService.isForestClientUserAllowedStateAccess).toHaveBeenCalledWith(
        TEST_PROJECT_ID,
        [WorkflowStateEnum.COMMENT_OPEN, WorkflowStateEnum.COMMENT_CLOSED],
        user
      );
    });

    it('isViewAuthorized returns false for anonymous, true for ministry, delegates for client user', async () => {
      const entity = new Interaction();
      entity.projectId = TEST_PROJECT_ID;

      expect(await service.isViewAuthorized(entity, undefined)).toBe(false);

      const ministryUser = new User();
      ministryUser.isMinistry = true;
      expect(await service.isViewAuthorized(entity, ministryUser)).toBe(true);

      const clientUser = new User();
      clientUser.isMinistry = false;
      (mockProjectAuthService.isForestClientUserAccess as jest.Mock).mockResolvedValue(true);

      expect(await service.isViewAuthorized(entity, clientUser)).toBe(true);
      expect(mockProjectAuthService.isForestClientUserAccess).toHaveBeenCalledWith(TEST_PROJECT_ID, clientUser);
    });
  });

  describe('businessValidate', () => {
    it('throws BadRequestException if communication date is before project commenting open date', async () => {
      const project = new ProjectResponse();
      project.commentingOpenDate = '2026-06-01';
      (mockProjectService.findOne as jest.Mock).mockResolvedValue(project);

      const request = new InteractionCreateRequest();
      request.projectId = TEST_PROJECT_ID;
      request.communicationDate = '2026-05-15';

      await expect(service.create(request, new User())).rejects.toThrow(BadRequestException);
    });
  });

  describe('create and update with attachment linking', () => {
    it('creates interaction and links attachment when file is provided', async () => {
      const user = new User();
      const project = new ProjectResponse();
      project.commentingOpenDate = '2026-01-01';
      (mockProjectService.findOne as jest.Mock).mockResolvedValue(project);

      (mockProjectAuthService.isForestClientUserAllowedStateAccess as jest.Mock).mockResolvedValue(true);

      const attachmentResponse = new AttachmentResponse();
      attachmentResponse.id = TEST_ATTACHMENT_ID;
      (mockAttachmentService.create as jest.Mock).mockResolvedValue(attachmentResponse);

      const savedInteraction = new Interaction();
      savedInteraction.id = TEST_INTERACTION_ID;
      savedInteraction.projectId = TEST_PROJECT_ID;
      savedInteraction.stakeholder = 'First Nation Group';
      savedInteraction.communicationDate = '2026-01-10';
      savedInteraction.communicationDetails = 'Discussion on road access';
      savedInteraction.attachmentId = TEST_ATTACHMENT_ID;
      savedInteraction.createTimestamp = new Date();
      savedInteraction.revisionCount = 1;

      (mockRepository.save as jest.Mock).mockResolvedValue(savedInteraction);

      const request = new InteractionCreateRequest();
      request.projectId = TEST_PROJECT_ID;
      request.stakeholder = 'First Nation Group';
      request.communicationDate = '2026-01-10';
      request.communicationDetails = 'Discussion on road access';
      request.fileName = 'minutes.pdf';
      request.file = Buffer.from('test-pdf');

      const result = await service.create(request, user);

      expect(mockAttachmentService.create).toHaveBeenCalled();
      expect(result.id).toBe(TEST_INTERACTION_ID);
      expect(result.attachmentId).toBe(TEST_ATTACHMENT_ID);
    });
  });

  describe('findByProjectId', () => {
    it('throws ForbiddenException if non-ministry user has no forest client access', async () => {
      const clientUser = new User();
      clientUser.isMinistry = false;

      (mockProjectAuthService.isForestClientUserAccess as jest.Mock).mockResolvedValue(false);

      await expect(service.findByProjectId(TEST_PROJECT_ID, clientUser)).rejects.toThrow(ForbiddenException);
    });

    it('returns interactions with attachment filenames for authorized user', async () => {
      const ministryUser = new User();
      ministryUser.isMinistry = true;

      const record = new Interaction();
      record.id = TEST_INTERACTION_ID;
      record.projectId = TEST_PROJECT_ID;
      record.stakeholder = 'Community Rep';
      record.communicationDate = '2026-02-01';
      record.communicationDetails = 'Notes';
      record.attachmentId = TEST_ATTACHMENT_ID;
      record.createTimestamp = new Date();
      record.revisionCount = 1;

      (mockRepository.find as jest.Mock).mockResolvedValue([record]);

      const attachment = new AttachmentResponse();
      attachment.id = TEST_ATTACHMENT_ID;
      attachment.fileName = 'attachment.pdf';
      (mockAttachmentService.findOne as jest.Mock).mockResolvedValue(attachment);

      const result = await service.findByProjectId(TEST_PROJECT_ID, ministryUser);

      expect(result.length).toBe(1);
      expect(result[0].fileName).toBe('attachment.pdf');
    });
  });

  describe('delete', () => {
    it('deletes interaction and associated attachment', async () => {
      const user = new User();
      const entity = new Interaction();
      entity.id = TEST_INTERACTION_ID;
      entity.projectId = TEST_PROJECT_ID;
      entity.attachmentId = TEST_ATTACHMENT_ID;

      (mockRepository.findOne as jest.Mock).mockResolvedValue(entity);
      (mockProjectAuthService.isForestClientUserAllowedStateAccess as jest.Mock).mockResolvedValue(true);
      (mockRepository.delete as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.delete(TEST_INTERACTION_ID, user);

      expect(mockRepository.delete).toHaveBeenCalledWith(TEST_INTERACTION_ID);
      expect(mockAttachmentService.delete).toHaveBeenCalledWith(TEST_ATTACHMENT_ID, user);
    });
  });
});
