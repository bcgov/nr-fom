import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { User } from '@utility/security/user';
import { mockLoggerFactory } from '../../factories/mock-logger.factory';
import { ProjectController } from './project.controller';
import {
  ProjectCommentClassificationMandatoryChangeRequest,
  ProjectCommentingClosedDateChangeRequest,
  ProjectCreateRequest,
  ProjectMetricsResponse,
  ProjectPublicSummaryResponse,
  ProjectResponse,
  ProjectUpdateRequest,
  ProjectWorkflowStateChangeRequest,
} from './project.dto';
import { ProjectFindCriteria, ProjectService } from './project.service';
import { WorkflowStateEnum } from './workflow-state-code.entity';

describe('ProjectController', () => {
  let controller: ProjectController;
  let mockService: Partial<ProjectService>;

  beforeEach(() => {
    mockService = {
      findPublicSummaries: jest.fn(),
      findOne: jest.fn(),
      findProjectMetrics: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      workflowStateChange: jest.fn(),
      delete: jest.fn(),
      commentClassificationMandatoryChange: jest.fn(),
      commentingClosedDateChange: jest.fn(),
    };

    controller = new ProjectController(mockService as ProjectService, mockLoggerFactory());
  });

  describe('findPublicSummary', () => {
    it('populates default search criteria with comment open and closed states', async () => {
      const summaries = [new ProjectPublicSummaryResponse()];
      (mockService.findPublicSummaries as jest.Mock).mockResolvedValue(summaries);

      const result = await controller.findPublicSummary();

      expect(result).toBe(summaries);
      expect(mockService.findPublicSummaries).toHaveBeenCalledTimes(1);

      const criteria: ProjectFindCriteria = (mockService.findPublicSummaries as jest.Mock).mock.calls[0][0];
      expect(criteria.includeWorkflowStateCodes).toEqual([
        WorkflowStateEnum.COMMENT_OPEN,
        WorkflowStateEnum.COMMENT_CLOSED,
        WorkflowStateEnum.FINALIZED,
      ]);
      expect(criteria.projectId).toBeUndefined();
      expect(criteria.likeForestClientName).toBeUndefined();
    });

    it('parses projectId, forestClientName, and openedOnOrAfter date', async () => {
      (mockService.findPublicSummaries as jest.Mock).mockResolvedValue([]);

      await controller.findPublicSummary('123', 'true', 'false', 'Acme Forestry', '2026-01-15');

      const criteria: ProjectFindCriteria = (mockService.findPublicSummaries as jest.Mock).mock.calls[0][0];
      expect(criteria.projectId).toBe(123);
      expect(criteria.likeForestClientName).toBe('Acme Forestry');
      expect(criteria.commentingOpenedOnOrAfter).toBe('2026-01-15');
      expect(criteria.includeWorkflowStateCodes).toEqual([WorkflowStateEnum.COMMENT_OPEN]);
    });

    it('throws BadRequestException if both includeCommentOpen and includePostCommentOpen are not true', async () => {
      await expect(controller.findPublicSummary(undefined, 'false', 'false')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('delegates to service.findOne with id and user', async () => {
      const user = new User();
      const response = new ProjectResponse();
      (mockService.findOne as jest.Mock).mockResolvedValue(response);

      const result = await controller.findOne(user, 42);

      expect(result).toBe(response);
      expect(mockService.findOne).toHaveBeenCalledWith(42, user);
    });
  });

  describe('findProjectMetrics', () => {
    it('delegates to service.findProjectMetrics with id and user', async () => {
      const user = new User();
      const metrics = new ProjectMetricsResponse();
      (mockService.findProjectMetrics as jest.Mock).mockResolvedValue(metrics);

      const result = await controller.findProjectMetrics(user, 42);

      expect(result).toBe(metrics);
      expect(mockService.findProjectMetrics).toHaveBeenCalledWith(42, user);
    });
  });

  describe('find', () => {
    it('throws ForbiddenException when user is not authorized for admin site', async () => {
      const user = new User();
      jest.spyOn(user, 'isAuthorizedForAdminSite').mockReturnValue(false);

      await expect(controller.find(user)).rejects.toThrow(ForbiddenException);
    });

    it('populates findCriteria with numeric and text parameters for ministry user', async () => {
      const user = new User();
      user.isMinistry = true;
      jest.spyOn(user, 'isAuthorizedForAdminSite').mockReturnValue(true);

      const projects = [new ProjectResponse()];
      (mockService.find as jest.Mock).mockResolvedValue(projects);

      const result = await controller.find(user, '10', '20', '30', WorkflowStateEnum.INITIAL, 'Forest Corp');

      expect(result).toBe(projects);
      const criteria: ProjectFindCriteria = (mockService.find as jest.Mock).mock.calls[0][0];
      expect(criteria.projectId).toBe(10);
      expect(criteria.fspId).toBe(20);
      expect(criteria.districtId).toBe(30);
      expect(criteria.includeWorkflowStateCodes).toEqual([WorkflowStateEnum.INITIAL]);
      expect(criteria.likeForestClientName).toBe('Forest Corp');
      expect(criteria.includeForestClientNumbers).toEqual([]);
    });

    it('scopes query to user client IDs for non-ministry forest client user', async () => {
      const user = new User();
      user.isMinistry = false;
      user.isForestClient = true;
      user.clientIds = ['1011', '1012'];
      jest.spyOn(user, 'isAuthorizedForAdminSite').mockReturnValue(true);

      (mockService.find as jest.Mock).mockResolvedValue([]);

      await controller.find(user);

      const criteria: ProjectFindCriteria = (mockService.find as jest.Mock).mock.calls[0][0];
      expect(criteria.includeForestClientNumbers).toEqual(['1011', '1012']);
    });

    it('throws BadRequestException when projectId exceeds maximum 32-bit integer', async () => {
      const user = new User();
      user.isMinistry = true;
      jest.spyOn(user, 'isAuthorizedForAdminSite').mockReturnValue(true);

      await expect(controller.find(user, '9999999999')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when fspId exceeds maximum 32-bit integer', async () => {
      const user = new User();
      user.isMinistry = true;
      jest.spyOn(user, 'isAuthorizedForAdminSite').mockReturnValue(true);

      await expect(controller.find(user, undefined, '2147483648')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when districtId is negative or zero', async () => {
      const user = new User();
      user.isMinistry = true;
      jest.spyOn(user, 'isAuthorizedForAdminSite').mockReturnValue(true);

      await expect(controller.find(user, undefined, undefined, '0')).rejects.toThrow(BadRequestException);
    });
  });

  describe('create', () => {
    it('delegates creation to service.create', async () => {
      const user = new User();
      const request = new ProjectCreateRequest();
      const response = new ProjectResponse();
      (mockService.create as jest.Mock).mockResolvedValue(response);

      const result = await controller.create(user, request);

      expect(result).toBe(response);
      expect(mockService.create).toHaveBeenCalledWith(request, user);
    });
  });

  describe('update', () => {
    it('delegates update to service.update', async () => {
      const user = new User();
      const request = new ProjectUpdateRequest();
      const response = new ProjectResponse();
      (mockService.update as jest.Mock).mockResolvedValue(response);

      const result = await controller.update(user, 99, request);

      expect(result).toBe(response);
      expect(mockService.update).toHaveBeenCalledWith(99, request, user);
    });
  });

  describe('stateChange', () => {
    it('delegates state change to service.workflowStateChange', async () => {
      const user = new User();
      const request = new ProjectWorkflowStateChangeRequest();
      const response = new ProjectResponse();
      (mockService.workflowStateChange as jest.Mock).mockResolvedValue(response);

      const result = await controller.stateChange(user, 99, request);

      expect(result).toBe(response);
      expect(mockService.workflowStateChange).toHaveBeenCalledWith(99, request, user);
    });
  });

  describe('remove', () => {
    it('delegates deletion to service.delete', async () => {
      const user = new User();
      (mockService.delete as jest.Mock).mockResolvedValue(undefined);

      await controller.remove(user, 99);

      expect(mockService.delete).toHaveBeenCalledWith(99, user);
    });
  });

  describe('commentClassificationMandatoryChange', () => {
    it('delegates commentClassificationMandatoryChange to service', async () => {
      const user = new User();
      const request = new ProjectCommentClassificationMandatoryChangeRequest();
      const response = new ProjectResponse();
      (mockService.commentClassificationMandatoryChange as jest.Mock).mockResolvedValue(response);

      const result = await controller.commentClassificationMandatoryChange(user, 99, request);

      expect(result).toBe(response);
      expect(mockService.commentClassificationMandatoryChange).toHaveBeenCalledWith(99, request, user);
    });
  });

  describe('commentingClosedDateChange', () => {
    it('delegates commentingClosedDateChange to service', async () => {
      const user = new User();
      const request = new ProjectCommentingClosedDateChangeRequest();
      (mockService.commentingClosedDateChange as jest.Mock).mockResolvedValue(true);

      const result = await controller.commentingClosedDateChange(user, 99, request);

      expect(result).toBe(true);
      expect(mockService.commentingClosedDateChange).toHaveBeenCalledWith(99, request, user);
    });
  });
});
