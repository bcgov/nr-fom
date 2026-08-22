import { BadRequestException } from '@nestjs/common';
import { User } from '@utility/security/user';
import { Request } from 'express';
import { AttachmentTypeCode, AttachmentTypeEnum } from './attachment-type-code.entity';
import { AttachmentController } from './attachment.controller';
import { AttachmentFileResponse, AttachmentResponse } from './attachment.dto';
import { AttachmentService } from './attachment.service';

describe('AttachmentController', () => {
  let controller: AttachmentController;
  let mockService: Partial<AttachmentService>;

  const TEST_PROJECT_ID = 100;
  const TEST_ATTACHMENT_ID = 200;

  beforeEach(() => {
    mockService = {
      create: jest.fn(),
      getFileContent: jest.fn(),
      findOne: jest.fn(),
      findByProjectIdNoInteraction: jest.fn(),
      delete: jest.fn(),
    };

    controller = new AttachmentController(mockService as AttachmentService);
  });

  describe('create', () => {
    it('extracts multipart form attributes, validates type, and creates attachment', async () => {
      const user = new User();
      const mockFile = {
        originalname: 'notice.pdf',
        buffer: Buffer.from('test-buffer'),
      } as Express.Multer.File;

      const mockRequest = {
        body: {
          projectId: `${TEST_PROJECT_ID}`,
          attachmentTypeCode: AttachmentTypeEnum.PUBLIC_NOTICE,
        },
      } as unknown as Request;

      const createdResponse = new AttachmentResponse();
      createdResponse.id = TEST_ATTACHMENT_ID;
      (mockService.create as jest.Mock).mockResolvedValue(createdResponse);

      const result = await controller.create(user, mockFile, mockRequest as any);

      expect(result).toBe(createdResponse);
      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: TEST_PROJECT_ID,
          attachmentTypeCode: AttachmentTypeEnum.PUBLIC_NOTICE,
          fileName: 'notice.pdf',
          fileContents: mockFile.buffer,
        }),
        user
      );
    });

    it('throws BadRequestException on invalid attachmentTypeCode', async () => {
      const user = new User();
      const mockFile = {
        originalname: 'file.pdf',
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      const mockRequest = {
        body: {
          projectId: '100',
          attachmentTypeCode: 'INVALID_TYPE',
        },
      } as unknown as Request;

      await expect(controller.create(user, mockFile, mockRequest as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getFileContents', () => {
    it('retrieves file contents and pipes to response', async () => {
      const user = new User();
      const fileResponse = new AttachmentFileResponse();
      fileResponse.fileName = 'download.pdf';
      fileResponse.fileContents = Buffer.from('content');

      (mockService.getFileContent as jest.Mock).mockResolvedValue(fileResponse);

      const mockResponse = {
        attachment: jest.fn(),
        send: jest.fn(),
      };

      await controller.getFileContents(user, TEST_ATTACHMENT_ID, mockResponse);

      expect(mockService.getFileContent).toHaveBeenCalledWith(TEST_ATTACHMENT_ID, user);
      expect(mockResponse.attachment).toHaveBeenCalledWith('download.pdf');
      expect(mockResponse.send).toHaveBeenCalledWith(fileResponse.fileContents);
    });
  });

  describe('findOne', () => {
    it('delegates to service.findOne with id and user', async () => {
      const user = new User();
      const response = new AttachmentResponse();
      (mockService.findOne as jest.Mock).mockResolvedValue(response);

      const result = await controller.findOne(user, TEST_ATTACHMENT_ID);

      expect(result).toBe(response);
      expect(mockService.findOne).toHaveBeenCalledWith(TEST_ATTACHMENT_ID, user);
    });
  });

  describe('find', () => {
    it('delegates to service.findByProjectIdNoInteraction with projectId and user', async () => {
      const user = new User();
      const list = [new AttachmentResponse()];
      (mockService.findByProjectIdNoInteraction as jest.Mock).mockResolvedValue(list);

      const result = await controller.find(user, TEST_PROJECT_ID);

      expect(result).toBe(list);
      expect(mockService.findByProjectIdNoInteraction).toHaveBeenCalledWith(TEST_PROJECT_ID, user);
    });
  });

  describe('remove', () => {
    it('delegates to service.delete with id and user', async () => {
      const user = new User();
      (mockService.delete as jest.Mock).mockResolvedValue(undefined);

      await controller.remove(user, TEST_ATTACHMENT_ID);

      expect(mockService.delete).toHaveBeenCalledWith(TEST_ATTACHMENT_ID, user);
    });
  });
});
