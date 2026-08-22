import { BadRequestException } from '@nestjs/common';
import { User } from '@utility/security/user';
import { Request } from 'express';
import { mockLoggerFactory } from '../../factories/mock-logger.factory';
import { InteractionController } from './interaction.controller';
import { InteractionResponse } from './interaction.dto';
import { InteractionService } from './interaction.service';

describe('InteractionController', () => {
  let controller: InteractionController;
  let mockService: Partial<InteractionService>;

  const TEST_PROJECT_ID = 100;
  const TEST_INTERACTION_ID = 50;

  beforeEach(() => {
    mockService = {
      create: jest.fn(),
      findByProjectId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    controller = new InteractionController(mockService as InteractionService, mockLoggerFactory());
  });

  describe('create', () => {
    it('constructs DTO, validates, and delegates creation to service', async () => {
      const user = new User();
      const mockFile = {
        originalname: 'meeting_notes.pdf',
        buffer: Buffer.from('pdf-content'),
      } as Express.Multer.File;

      const mockRequest = {
        body: {
          projectId: `${TEST_PROJECT_ID}`,
          stakeholder: 'First Nation Rep',
          communicationDate: '2026-06-01',
          communicationDetails: 'Discussed road sections',
        },
      } as unknown as Request;

      const response = new InteractionResponse();
      response.id = TEST_INTERACTION_ID;
      (mockService.create as jest.Mock).mockResolvedValue(response);

      const result = await controller.create(user, mockFile, mockRequest as any);

      expect(result).toBe(response);
      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: TEST_PROJECT_ID,
          stakeholder: 'First Nation Rep',
          communicationDate: '2026-06-01',
          communicationDetails: 'Discussed road sections',
          fileName: 'meeting_notes.pdf',
        }),
        user
      );
    });

    it('throws BadRequestException when class-validator validation fails', async () => {
      const user = new User();
      const mockRequest = {
        body: {
          projectId: `${TEST_PROJECT_ID}`,
          stakeholder: '', // blank stakeholder fails @IsNotEmpty()
          communicationDate: 'invalid-date',
          communicationDetails: '',
        },
      } as unknown as Request;

      await expect(controller.create(user, undefined as any, mockRequest as any)).rejects.toThrow(
        BadRequestException
      );
    });

    it('throws BadRequestException when fileName is provided without file contents', async () => {
      const user = new User();
      const mockRequest = {
        body: {
          projectId: `${TEST_PROJECT_ID}`,
          stakeholder: 'Stakeholder',
          communicationDate: '2026-06-01',
          communicationDetails: 'Details',
          filename: 'orphan.pdf',
        },
      } as unknown as Request;

      await expect(controller.create(user, undefined as any, mockRequest as any)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('find', () => {
    it('delegates to service.findByProjectId with projectId and user', async () => {
      const user = new User();
      const responses = [new InteractionResponse()];
      (mockService.findByProjectId as jest.Mock).mockResolvedValue(responses);

      const result = await controller.find(user, TEST_PROJECT_ID);

      expect(result).toBe(responses);
      expect(mockService.findByProjectId).toHaveBeenCalledWith(TEST_PROJECT_ID, user);
    });
  });

  describe('update', () => {
    it('validates and delegates update to service without file', async () => {
      const user = new User();
      const mockRequest = {
        body: {
          projectId: `${TEST_PROJECT_ID}`,
          stakeholder: 'First Nation Rep',
          communicationDate: '2026-06-01',
          communicationDetails: 'Updated details',
          revisionCount: '1',
        },
      } as unknown as Request;

      const response = new InteractionResponse();
      response.id = TEST_INTERACTION_ID;
      (mockService.update as jest.Mock).mockResolvedValue(response);

      const result = await controller.update(user, TEST_INTERACTION_ID, undefined as any, mockRequest as any);

      expect(result).toBe(response);
      expect(mockService.update).toHaveBeenCalledWith(
        TEST_INTERACTION_ID,
        expect.objectContaining({
          projectId: TEST_PROJECT_ID,
          stakeholder: 'First Nation Rep',
          revisionCount: 1,
        }),
        user
      );
    });

    it('validates and delegates update to service with replacement file', async () => {
      const user = new User();
      const mockFile = {
        originalname: 'replacement.pdf',
        buffer: Buffer.from('new-pdf-bytes'),
      } as Express.Multer.File;

      const mockRequest = {
        body: {
          projectId: `${TEST_PROJECT_ID}`,
          stakeholder: 'First Nation Rep',
          communicationDate: '2026-06-01',
          communicationDetails: 'Updated details',
          revisionCount: '1',
        },
      } as unknown as Request;

      const response = new InteractionResponse();
      response.id = TEST_INTERACTION_ID;
      (mockService.update as jest.Mock).mockResolvedValue(response);

      const result = await controller.update(user, TEST_INTERACTION_ID, mockFile, mockRequest as any);

      expect(result).toBe(response);
      expect(mockService.update).toHaveBeenCalledWith(
        TEST_INTERACTION_ID,
        expect.objectContaining({
          projectId: TEST_PROJECT_ID,
          fileName: 'replacement.pdf',
          file: mockFile.buffer,
          revisionCount: 1,
        }),
        user
      );
    });

    it('throws BadRequestException when fileName is provided without file contents on update', async () => {
      const user = new User();
      const mockRequest = {
        body: {
          projectId: `${TEST_PROJECT_ID}`,
          stakeholder: 'Stakeholder',
          communicationDate: '2026-06-01',
          communicationDetails: 'Details',
          filename: 'orphan_update.pdf',
          revisionCount: '1',
        },
      } as unknown as Request;

      await expect(
        controller.update(user, TEST_INTERACTION_ID, undefined as any, mockRequest as any)
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when update validation fails', async () => {
      const user = new User();
      const mockRequest = {
        body: {
          projectId: `${TEST_PROJECT_ID}`,
          stakeholder: '',
          communicationDate: '2026-06-01',
          revisionCount: 'not-a-number',
        },
      } as unknown as Request;

      await expect(
        controller.update(user, TEST_INTERACTION_ID, undefined as any, mockRequest as any)
      ).rejects.toThrow();
    });
  });

  describe('remove', () => {
    it('delegates to service.delete with id and user', async () => {
      const user = new User();
      (mockService.delete as jest.Mock).mockResolvedValue(undefined);

      await controller.remove(user, TEST_INTERACTION_ID);

      expect(mockService.delete).toHaveBeenCalledWith(TEST_INTERACTION_ID, user);
    });
  });
});
