import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { User } from '@utility/security/user';
import { Readable } from 'node:stream';
import { Repository } from 'typeorm';
import { minioClient } from '../../../minio';
import { mockLoggerFactory } from '../../factories/mock-logger.factory';
import { ProjectAuthService } from '../project/project-auth.service';
import { WorkflowStateEnum } from '../project/workflow-state-code.entity';
import { AttachmentTypeCode, AttachmentTypeEnum } from './attachment-type-code.entity';
import { AttachmentCreateRequest, AttachmentResponse } from './attachment.dto';
import { Attachment } from './attachment.entity';
import { AttachmentService } from './attachment.service';

describe('AttachmentService', () => {
  let service: AttachmentService;
  let mockRepository: Partial<Repository<Attachment>>;
  let mockProjectAuthService: Partial<ProjectAuthService>;

  const TEST_PROJECT_ID = 100;
  const TEST_ATTACHMENT_ID = 200;

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

    service = new AttachmentService(
      mockRepository as Repository<Attachment>,
      mockLoggerFactory(),
      mockProjectAuthService as ProjectAuthService
    );
  });

  describe('isUpdateAuthorized', () => {
    it('always returns false as updates are disallowed', async () => {
      expect(await service.isUpdateAuthorized({}, new Attachment(), new User())).toBe(false);
    });
  });

  describe('isCreateAuthorized', () => {
    it('checks COMMENT_OPEN and COMMENT_CLOSED states for INTERACTION attachment type', async () => {
      const user = new User();
      const request = new AttachmentCreateRequest();
      request.projectId = TEST_PROJECT_ID;
      request.attachmentTypeCode = AttachmentTypeEnum.INTERACTION;

      (mockProjectAuthService.isForestClientUserAllowedStateAccess as jest.Mock).mockResolvedValue(true);

      const result = await service.isCreateAuthorized(request, user);

      expect(result).toBe(true);
      expect(mockProjectAuthService.isForestClientUserAllowedStateAccess).toHaveBeenCalledWith(
        TEST_PROJECT_ID,
        [WorkflowStateEnum.COMMENT_OPEN, WorkflowStateEnum.COMMENT_CLOSED],
        user
      );
    });

    it('checks INITIAL, COMMENT_OPEN, and COMMENT_CLOSED states for other attachment types', async () => {
      const user = new User();
      const request = new AttachmentCreateRequest();
      request.projectId = TEST_PROJECT_ID;
      request.attachmentTypeCode = AttachmentTypeEnum.SUPPORTING_DOC;

      (mockProjectAuthService.isForestClientUserAllowedStateAccess as jest.Mock).mockResolvedValue(true);

      const result = await service.isCreateAuthorized(request, user);

      expect(result).toBe(true);
      expect(mockProjectAuthService.isForestClientUserAllowedStateAccess).toHaveBeenCalledWith(
        TEST_PROJECT_ID,
        [WorkflowStateEnum.INITIAL, WorkflowStateEnum.COMMENT_OPEN, WorkflowStateEnum.COMMENT_CLOSED],
        user
      );
    });
  });

  describe('isDeleteAuthorized', () => {
    it('authorizes INTERACTION deletion for COMMENT_OPEN and COMMENT_CLOSED states', async () => {
      const user = new User();
      const entity = new Attachment();
      entity.projectId = TEST_PROJECT_ID;
      entity.attachmentType = { code: AttachmentTypeEnum.INTERACTION } as AttachmentTypeCode;

      (mockProjectAuthService.isForestClientUserAllowedStateAccess as jest.Mock).mockResolvedValue(true);

      const result = await service.isDeleteAuthorized(entity, user);

      expect(result).toBe(true);
      expect(mockProjectAuthService.isForestClientUserAllowedStateAccess).toHaveBeenCalledWith(
        TEST_PROJECT_ID,
        [WorkflowStateEnum.COMMENT_OPEN, WorkflowStateEnum.COMMENT_CLOSED],
        user
      );
    });

    it('authorizes PUBLIC_NOTICE deletion only for INITIAL state', async () => {
      const user = new User();
      const entity = new Attachment();
      entity.projectId = TEST_PROJECT_ID;
      entity.attachmentType = { code: AttachmentTypeEnum.PUBLIC_NOTICE } as AttachmentTypeCode;

      (mockProjectAuthService.isForestClientUserAllowedStateAccess as jest.Mock).mockResolvedValue(true);

      const result = await service.isDeleteAuthorized(entity, user);

      expect(result).toBe(true);
      expect(mockProjectAuthService.isForestClientUserAllowedStateAccess).toHaveBeenCalledWith(
        TEST_PROJECT_ID,
        [WorkflowStateEnum.INITIAL],
        user
      );
    });

    it('authorizes SUPPORTING_DOC deletion for INITIAL, COMMENT_OPEN, and COMMENT_CLOSED states', async () => {
      const user = new User();
      const entity = new Attachment();
      entity.projectId = TEST_PROJECT_ID;
      entity.attachmentType = { code: AttachmentTypeEnum.SUPPORTING_DOC } as AttachmentTypeCode;

      (mockProjectAuthService.isForestClientUserAllowedStateAccess as jest.Mock).mockResolvedValue(true);

      const result = await service.isDeleteAuthorized(entity, user);

      expect(result).toBe(true);
      expect(mockProjectAuthService.isForestClientUserAllowedStateAccess).toHaveBeenCalledWith(
        TEST_PROJECT_ID,
        [WorkflowStateEnum.INITIAL, WorkflowStateEnum.COMMENT_OPEN, WorkflowStateEnum.COMMENT_CLOSED],
        user
      );
    });
  });

  describe('isViewAuthorized', () => {
    it('returns true for PUBLIC_NOTICE and SUPPORTING_DOC for public users', async () => {
      const notice = new Attachment();
      notice.attachmentType = { code: AttachmentTypeEnum.PUBLIC_NOTICE } as AttachmentTypeCode;
      expect(await service.isViewAuthorized(notice, undefined)).toBe(true);

      const doc = new Attachment();
      doc.attachmentType = { code: AttachmentTypeEnum.SUPPORTING_DOC } as AttachmentTypeCode;
      expect(await service.isViewAuthorized(doc, undefined)).toBe(true);
    });

    it('returns true for ministry user on any attachment type', async () => {
      const ministryUser = new User();
      ministryUser.isMinistry = true;

      const interaction = new Attachment();
      interaction.attachmentType = { code: AttachmentTypeEnum.INTERACTION } as AttachmentTypeCode;

      expect(await service.isViewAuthorized(interaction, ministryUser)).toBe(true);
    });

    it('delegates to projectAuthService.isForestClientUserAccess for non-ministry interaction viewing', async () => {
      const clientUser = new User();
      clientUser.isMinistry = false;

      const interaction = new Attachment();
      interaction.projectId = TEST_PROJECT_ID;
      interaction.attachmentType = { code: AttachmentTypeEnum.INTERACTION } as AttachmentTypeCode;

      (mockProjectAuthService.isForestClientUserAccess as jest.Mock).mockResolvedValue(true);

      expect(await service.isViewAuthorized(interaction, clientUser)).toBe(true);
      expect(mockProjectAuthService.isForestClientUserAccess).toHaveBeenCalledWith(TEST_PROJECT_ID, clientUser);
    });
  });

  describe('create file validation and replacement', () => {
    it('rejects disallowed file extensions for PUBLIC_NOTICE with BadRequestException', async () => {
      const request = new AttachmentCreateRequest();
      request.projectId = TEST_PROJECT_ID;
      request.attachmentTypeCode = AttachmentTypeEnum.PUBLIC_NOTICE;
      request.fileName = 'notice.docx'; // docx is not allowed for public notice

      await expect(service.create(request, new User())).rejects.toThrow(BadRequestException);
    });

    it('rejects unpermitted file extensions for SUPPORTING_DOC with BadRequestException', async () => {
      const request = new AttachmentCreateRequest();
      request.projectId = TEST_PROJECT_ID;
      request.attachmentTypeCode = AttachmentTypeEnum.SUPPORTING_DOC;
      request.fileName = 'script.sh';

      await expect(service.create(request, new User())).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException during public notice replacement if user is not authorized', async () => {
      const request = new AttachmentCreateRequest();
      request.projectId = TEST_PROJECT_ID;
      request.attachmentTypeCode = AttachmentTypeEnum.PUBLIC_NOTICE;
      request.fileName = 'notice.pdf';

      const existingNotice = new Attachment();
      existingNotice.id = TEST_ATTACHMENT_ID;
      existingNotice.projectId = TEST_PROJECT_ID;
      existingNotice.fileName = 'old_notice.pdf';

      (mockRepository.find as jest.Mock).mockResolvedValue([existingNotice]);
      (mockProjectAuthService.isForestClientUserAllowedStateAccess as jest.Mock).mockResolvedValue(false);

      await expect(service.create(request, new User())).rejects.toThrow(ForbiddenException);
    });

    it('replaces existing public notice and saves new attachment when authorized', async () => {
      const user = new User();
      const request = new AttachmentCreateRequest();
      request.projectId = TEST_PROJECT_ID;
      request.attachmentTypeCode = AttachmentTypeEnum.PUBLIC_NOTICE;
      request.fileName = 'notice.pdf';
      request.fileContents = Buffer.from('test-content');

      const existingNotice = new Attachment();
      existingNotice.id = TEST_ATTACHMENT_ID;
      existingNotice.projectId = TEST_PROJECT_ID;
      existingNotice.fileName = 'old_notice.pdf';

      (mockRepository.find as jest.Mock).mockResolvedValue([existingNotice]);
      (mockProjectAuthService.isForestClientUserAllowedStateAccess as jest.Mock).mockResolvedValue(true);
      (mockRepository.delete as jest.Mock).mockResolvedValue({ affected: 1 });

      jest.spyOn(service, 'deleteObject').mockResolvedValue(undefined as any);
      jest.spyOn(service, 'uploadFileObjectStorage').mockImplementation(() => {});

      const newAttachment = new Attachment();
      newAttachment.id = 300;
      newAttachment.projectId = TEST_PROJECT_ID;
      newAttachment.fileName = 'notice.pdf';
      (mockRepository.save as jest.Mock).mockResolvedValue(newAttachment);

      const result = await service.create(request, user);

      expect(mockRepository.delete).toHaveBeenCalledWith(TEST_ATTACHMENT_ID);
      expect(service.deleteObject).toHaveBeenCalled();
      expect(service.uploadFileObjectStorage).toHaveBeenCalledWith(request, 300);
      expect(result.id).toBe(300);
    });
  });

  describe('getFileContent and stream conversion', () => {
    it('throws BadRequestException when attachment entity does not exist', async () => {
      (mockRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.getFileContent(TEST_ATTACHMENT_ID, new User())).rejects.toThrow(
        BadRequestException
      );
    });

    it('throws ForbiddenException when user is not authorized to view the file', async () => {
      const entity = new Attachment();
      entity.id = TEST_ATTACHMENT_ID;
      entity.projectId = TEST_PROJECT_ID;
      entity.attachmentType = { code: AttachmentTypeEnum.INTERACTION } as AttachmentTypeCode;

      (mockRepository.findOne as jest.Mock).mockResolvedValue(entity);
      (mockProjectAuthService.isForestClientUserAccess as jest.Mock).mockResolvedValue(false);

      const clientUser = new User();
      clientUser.isMinistry = false;

      await expect(service.getFileContent(TEST_ATTACHMENT_ID, clientUser)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('reads object stream and returns AttachmentFileResponse with buffer', async () => {
      const entity = new Attachment();
      entity.id = TEST_ATTACHMENT_ID;
      entity.projectId = TEST_PROJECT_ID;
      entity.fileName = 'public_notice.pdf';
      entity.attachmentType = { code: AttachmentTypeEnum.PUBLIC_NOTICE } as AttachmentTypeCode;

      (mockRepository.findOne as jest.Mock).mockResolvedValue(entity);

      const stream = Readable.from([Buffer.from('chunk1-'), Buffer.from('chunk2')]);
      jest.spyOn(service, 'getObjectStream').mockResolvedValue(stream as any);

      const result = await service.getFileContent(TEST_ATTACHMENT_ID, undefined);

      expect(result.id).toBe(TEST_ATTACHMENT_ID);
      expect(result.fileName).toBe('public_notice.pdf');
      expect(result.fileContents.toString()).toBe('chunk1-chunk2');
    });

    it('rejects with error when stream errors during conversion', async () => {
      const { Readable: StreamReadable } = require('node:stream');
      const errorStream = new StreamReadable({
        read() {
          this.emit('error', new Error('Stream read failure'));
        },
      });

      await expect(service.stream2buffer(errorStream)).rejects.toContain('Stream read failure');
    });
  });

  describe('delete and object removal', () => {
    it('deletes entity from repository and deletes object storage file', async () => {
      const user = new User();
      const entity = new Attachment();
      entity.id = TEST_ATTACHMENT_ID;
      entity.projectId = TEST_PROJECT_ID;
      entity.fileName = 'doc.pdf';
      entity.attachmentType = { code: AttachmentTypeEnum.SUPPORTING_DOC } as AttachmentTypeCode;

      (mockRepository.findOne as jest.Mock).mockResolvedValue(entity);
      (mockProjectAuthService.isForestClientUserAllowedStateAccess as jest.Mock).mockResolvedValue(true);
      (mockRepository.delete as jest.Mock).mockResolvedValue({ affected: 1 });

      const deleteObjectSpy = jest.spyOn(service, 'deleteObject').mockResolvedValue(true);

      await service.delete(TEST_ATTACHMENT_ID, user);

      expect(mockRepository.delete).toHaveBeenCalledWith(TEST_ATTACHMENT_ID);
      expect(deleteObjectSpy).toHaveBeenCalled();
    });

    it('deleteObject resolves true on successful MinIO removal', async () => {
      const removeObjectSpy = jest
        .spyOn(minioClient, 'removeObject')
        .mockImplementation((bucket: any, objectName: any, cb: any) => {
          cb(null);
        });

      const result = await service.deleteObject('test-bucket', 'test-object');
      expect(result).toBe(true);

      removeObjectSpy.mockRestore();
    });

    it('deleteObject resolves false and logs error on MinIO failure', async () => {
      const removeObjectSpy = jest
        .spyOn(minioClient, 'removeObject')
        .mockImplementation((bucket: any, objectName: any, cb: any) => {
          cb(new Error('MinIO connection timeout'));
        });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.deleteObject('test-bucket', 'test-object');
      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();

      removeObjectSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });
});
