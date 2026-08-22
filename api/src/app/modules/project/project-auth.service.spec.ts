import { Project } from '@api-modules/project/project.entity';
import { ProjectAuthService } from '@api-modules/project/project-auth.service';
import { WorkflowStateEnum } from '@api-modules/project/workflow-state-code.entity';
import { User } from '@utility/security/user';
import { Repository } from 'typeorm';

describe('ProjectAuthService', () => {
  let service: ProjectAuthService;
  let mockRepository: Partial<Repository<Project>>;

  const TEST_PROJECT_ID = 100;
  const TEST_CLIENT_ID = '1011';
  const OTHER_CLIENT_ID = '9999';

  beforeEach(() => {
    mockRepository = {
      findOne: jest.fn(),
    };
    service = new ProjectAuthService(mockRepository as Repository<Project>);
  });

  describe('isForestClientUserAccess', () => {
    it('returns false when user is undefined or not a forest client user', async () => {
      expect(await service.isForestClientUserAccess(TEST_PROJECT_ID, undefined)).toBe(false);

      const ministryUser = new User();
      ministryUser.isForestClient = false;
      expect(await service.isForestClientUserAccess(TEST_PROJECT_ID, ministryUser)).toBe(false);
    });

    it('returns false when project cannot be found in repository', async () => {
      (mockRepository.findOne as jest.Mock).mockResolvedValue(null);

      const clientUser = new User();
      clientUser.isForestClient = true;
      clientUser.clientIds = [TEST_CLIENT_ID];

      expect(await service.isForestClientUserAccess(TEST_PROJECT_ID, clientUser)).toBe(false);
    });

    it('returns true when forest client user is authorized for the project client id', async () => {
      const project = new Project();
      project.id = TEST_PROJECT_ID;
      project.forestClientId = TEST_CLIENT_ID;
      (mockRepository.findOne as jest.Mock).mockResolvedValue(project);

      const clientUser = new User();
      clientUser.isForestClient = true;
      clientUser.clientIds = [TEST_CLIENT_ID];

      expect(await service.isForestClientUserAccess(TEST_PROJECT_ID, clientUser)).toBe(true);
    });

    it('returns false when forest client user is not authorized for the project client id', async () => {
      const project = new Project();
      project.id = TEST_PROJECT_ID;
      project.forestClientId = OTHER_CLIENT_ID;
      (mockRepository.findOne as jest.Mock).mockResolvedValue(project);

      const clientUser = new User();
      clientUser.isForestClient = true;
      clientUser.clientIds = [TEST_CLIENT_ID];

      expect(await service.isForestClientUserAccess(TEST_PROJECT_ID, clientUser)).toBe(false);
    });
  });

  describe('isForestClientUserAllowedStateAccess', () => {
    it('returns false when user is not a forest client user', async () => {
      expect(
        await service.isForestClientUserAllowedStateAccess(TEST_PROJECT_ID, [WorkflowStateEnum.INITIAL], undefined)
      ).toBe(false);
    });

    it('returns false when project is not found', async () => {
      (mockRepository.findOne as jest.Mock).mockResolvedValue(null);

      const clientUser = new User();
      clientUser.isForestClient = true;
      clientUser.clientIds = [TEST_CLIENT_ID];

      expect(
        await service.isForestClientUserAllowedStateAccess(TEST_PROJECT_ID, [WorkflowStateEnum.INITIAL], clientUser)
      ).toBe(false);
    });

    it('returns false when user client id does not match project client id', async () => {
      const project = new Project();
      project.id = TEST_PROJECT_ID;
      project.forestClientId = OTHER_CLIENT_ID;
      project.workflowStateCode = WorkflowStateEnum.INITIAL;
      (mockRepository.findOne as jest.Mock).mockResolvedValue(project);

      const clientUser = new User();
      clientUser.isForestClient = true;
      clientUser.clientIds = [TEST_CLIENT_ID];

      expect(
        await service.isForestClientUserAllowedStateAccess(TEST_PROJECT_ID, [WorkflowStateEnum.INITIAL], clientUser)
      ).toBe(false);
    });

    it('returns true when user is authorized and project workflow state is allowed', async () => {
      const project = new Project();
      project.id = TEST_PROJECT_ID;
      project.forestClientId = TEST_CLIENT_ID;
      project.workflowStateCode = WorkflowStateEnum.INITIAL;
      (mockRepository.findOne as jest.Mock).mockResolvedValue(project);

      const clientUser = new User();
      clientUser.isForestClient = true;
      clientUser.clientIds = [TEST_CLIENT_ID];

      expect(
        await service.isForestClientUserAllowedStateAccess(
          TEST_PROJECT_ID,
          [WorkflowStateEnum.INITIAL, WorkflowStateEnum.COMMENT_OPEN],
          clientUser
        )
      ).toBe(true);
    });

    it('returns false when user is authorized but project workflow state is not allowed', async () => {
      const project = new Project();
      project.id = TEST_PROJECT_ID;
      project.forestClientId = TEST_CLIENT_ID;
      project.workflowStateCode = WorkflowStateEnum.FINALIZED;
      (mockRepository.findOne as jest.Mock).mockResolvedValue(project);

      const clientUser = new User();
      clientUser.isForestClient = true;
      clientUser.clientIds = [TEST_CLIENT_ID];

      expect(
        await service.isForestClientUserAllowedStateAccess(
          TEST_PROJECT_ID,
          [WorkflowStateEnum.INITIAL, WorkflowStateEnum.COMMENT_OPEN],
          clientUser
        )
      ).toBe(false);
    });
  });

  describe('isAnonymousUserAllowedStateAccess', () => {
    it('returns false if a user object is provided (not anonymous)', async () => {
      const clientUser = new User();
      expect(
        await service.isAnonymousUserAllowedStateAccess(TEST_PROJECT_ID, [WorkflowStateEnum.COMMENT_OPEN], clientUser)
      ).toBe(false);
    });

    it('returns false when project is not found', async () => {
      (mockRepository.findOne as jest.Mock).mockResolvedValue(null);

      expect(
        await service.isAnonymousUserAllowedStateAccess(TEST_PROJECT_ID, [WorkflowStateEnum.COMMENT_OPEN], undefined)
      ).toBe(false);
    });

    it('returns true when workflow state is allowed', async () => {
      const project = new Project();
      project.id = TEST_PROJECT_ID;
      project.workflowStateCode = WorkflowStateEnum.COMMENT_OPEN;
      (mockRepository.findOne as jest.Mock).mockResolvedValue(project);

      expect(
        await service.isAnonymousUserAllowedStateAccess(
          TEST_PROJECT_ID,
          [WorkflowStateEnum.COMMENT_OPEN, WorkflowStateEnum.COMMENT_CLOSED],
          undefined
        )
      ).toBe(true);
    });

    it('returns false when workflow state is not allowed', async () => {
      const project = new Project();
      project.id = TEST_PROJECT_ID;
      project.workflowStateCode = WorkflowStateEnum.INITIAL;
      (mockRepository.findOne as jest.Mock).mockResolvedValue(project);

      expect(
        await service.isAnonymousUserAllowedStateAccess(
          TEST_PROJECT_ID,
          [WorkflowStateEnum.COMMENT_OPEN, WorkflowStateEnum.COMMENT_CLOSED],
          undefined
        )
      ).toBe(false);
    });
  });
});
