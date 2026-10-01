import { DateTimeUtil } from "@api-core/dateTimeUtil";
import { ProjectCreateRequest, ProjectUpdateRequest, ProjectWorkflowStateChangeRequest, ProjectResponse } from '@api-modules/project/project.dto';
import { Project } from '@api-modules/project/project.entity';
import { ProjectPlanCodeEnum } from '@api-modules/project/project-plan-code.entity';
import { ProjectService } from '@api-modules/project/project.service';
import { PublicNotice } from "@api-modules/project/public-notice.entity";
import { WorkflowStateEnum } from '@api-modules/project/workflow-state-code.entity';
import { Submission } from "@api-modules/submission/submission.entity";
import { SubmissionTypeCodeEnum } from "@api-modules/submission/submission-type-code.entity";
import { BadRequestException, InternalServerErrorException } from "@nestjs/common";
import { User } from "@utility/security/user";
import dayjs from 'dayjs';
import { mockLoggerFactory } from '../../factories/mock-logger.factory';

describe('ProjectService', () => {
  let service: ProjectService;

  beforeEach(async () => {
    service = new ProjectService(null, mockLoggerFactory(), null, null, null, null, null);
  });

  describe('isCreateAuthorized', () => {
    let request: ProjectCreateRequest;
    let user: User;
    const TEST_CLIENT_ID: string = '1011';

    beforeEach(async () => {
      user = new User();
      request = new ProjectCreateRequest();
      request.forestClientNumber = TEST_CLIENT_ID;
    })

    it ('public user cannot create', async () => {
      expect(await service.isCreateAuthorized(request, null)).toBe(false);
    });

    it ('forest client user with matching forest client can create', async () => {
      user.isForestClient = true;
      user.clientIds.push(TEST_CLIENT_ID);
      expect(await service.isCreateAuthorized(request, user)).toBe(true);
    });
    
    it ('request forest client undefined cannot create', async () => {
      user.isForestClient = true;
      user.clientIds.push(TEST_CLIENT_ID);
      delete request.forestClientNumber;
      expect(await service.isCreateAuthorized(request, user)).toBe(false);
    });
    
  });

  describe('isUpdateAuthorized', () => {
    let entity: Project;
    let request: ProjectUpdateRequest;
    let user: User;
    const TEST_CLIENT_ID = '1011';

    beforeEach(async () => {
      entity = new Project();
      user = new User();
      request = new ProjectUpdateRequest();
    })

    it ('public user cannot update', async () => {
      expect(await service.isUpdateAuthorized(request, entity, null)).toBe(false);
    });
    it ('ministry user cannot update when commenting open', async () => {
      user.isMinistry = true;
      entity.workflowStateCode = WorkflowStateEnum.COMMENT_OPEN;
      expect(await service.isUpdateAuthorized(request, entity, user)).toBe(false);
    });
    it ('ministry user cannot update when commenting closed', async () => {
      user.isMinistry = true;
      entity.workflowStateCode = WorkflowStateEnum.COMMENT_CLOSED;
      expect(await service.isUpdateAuthorized(request, entity, user)).toBe(false);
    });
    it ('forestry user for same client can update', async () => {
      entity.workflowStateCode = WorkflowStateEnum.INITIAL;
      user.isForestClient = true;
      user.clientIds.push(TEST_CLIENT_ID);
      entity.forestClientId = TEST_CLIENT_ID;
      expect(await service.isUpdateAuthorized(request, entity, user)).toBe(true);
    });
    it ('forestry user for different client cannot update', async () => {
      entity.workflowStateCode = WorkflowStateEnum.INITIAL;
      user.isForestClient = true;
      entity.forestClientId = TEST_CLIENT_ID;
      expect(await service.isUpdateAuthorized(request, entity, user)).toBe(false);
    });
    it ('forestry user cannot update when finalized', async () => {
      user.isForestClient = true;
      user.clientIds.push(TEST_CLIENT_ID);
      entity.forestClientId = TEST_CLIENT_ID;
      entity.workflowStateCode = WorkflowStateEnum.FINALIZED;
      expect(await service.isUpdateAuthorized(request, entity, user)).toBe(false);
    });
    it ('forestry user cannot update when published', async () => {
      user.isForestClient = true;
      user.clientIds.push(TEST_CLIENT_ID);
      entity.forestClientId = TEST_CLIENT_ID;
      entity.workflowStateCode = WorkflowStateEnum.PUBLISHED;
      expect(await service.isUpdateAuthorized(request, entity, user)).toBe(false);
    });

    it('ministry user who is also the forest client can update in INITIAL', async () => {
      user.isMinistry = true;
      user.isForestClient = true;
      user.clientIds.push(TEST_CLIENT_ID);
      entity.forestClientId = TEST_CLIENT_ID;
      entity.workflowStateCode = WorkflowStateEnum.INITIAL;
      expect(await service.isUpdateAuthorized(request, entity, user)).toBe(true);
    });

    it('rejects a commenting open date change after INITIAL', async () => {
      authorizeForestClient();
      entity.workflowStateCode = WorkflowStateEnum.COMMENT_OPEN;
      entity.commentingOpenDate = '2026-06-01';
      request.commentingOpenDate = '2026-06-02';
      expect(await service.isUpdateAuthorized(request, entity, user)).toBe(false);
    });

    it('allows an unchanged commenting open date after INITIAL when later locks do not apply', async () => {
      authorizeForestClient();
      entity.workflowStateCode = WorkflowStateEnum.COMMENT_CLOSED;
      entity.commentingOpenDate = '2026-06-01';
      entity.commentingClosedDate = '2026-07-15';
      entity.districtId = 10;
      request.commentingOpenDate = '2026-06-01';
      request.commentingClosedDate = '2026-07-15';
      request.districtId = 10;
      expect(await service.isUpdateAuthorized(request, entity, user)).toBe(true);
    });

    it('rejects a commenting closed date shorter than 30 days while commenting is open', async () => {
      authorizeForestClient();
      entity.workflowStateCode = WorkflowStateEnum.COMMENT_OPEN;
      entity.commentingOpenDate = '2026-06-01';
      request.commentingOpenDate = '2026-06-01';
      entity.commentingClosedDate = '2026-07-15';
      request.commentingClosedDate = '2026-06-15';
      expect(await service.isUpdateAuthorized(request, entity, user)).toBe(false);
    });

    it('allows a commenting closed date at least 30 days out while commenting is open', async () => {
      authorizeForestClient();
      alignCommentOpenFields();
      request.commentingClosedDate = '2026-07-01';
      expect(await service.isUpdateAuthorized(request, entity, user)).toBe(true);
    });

    it('rejects a locked operation field change while commenting is open', async () => {
      authorizeForestClient();
      alignCommentOpenFields();
      request.description = 'changed';
      expect(await service.isUpdateAuthorized(request, entity, user)).toBe(false);
    });

    it('rejects a district change while commenting is closed', async () => {
      authorizeForestClient();
      entity.workflowStateCode = WorkflowStateEnum.COMMENT_CLOSED;
      entity.commentingOpenDate = '2026-06-01';
      entity.commentingClosedDate = '2026-07-15';
      entity.districtId = 10;
      request.commentingOpenDate = '2026-06-01';
      request.commentingClosedDate = '2026-07-15';
      request.districtId = 11;
      expect(await service.isUpdateAuthorized(request, entity, user)).toBe(false);
    });

    function authorizeForestClient() {
      user.isForestClient = true;
      user.clientIds.push(TEST_CLIENT_ID);
      entity.forestClientId = TEST_CLIENT_ID;
    }

    function alignCommentOpenFields() {
      entity.workflowStateCode = WorkflowStateEnum.COMMENT_OPEN;
      entity.commentingOpenDate = '2026-06-01';
      entity.commentingClosedDate = '2026-07-15';
      entity.operationStartYear = 2026;
      entity.operationEndYear = 2027;
      entity.fspId = 10;
      entity.districtId = 10;
      entity.name = 'FOM';
      entity.bctsMgrName = 'Manager';
      entity.description = 'Same';
      request.commentingOpenDate = entity.commentingOpenDate;
      request.commentingClosedDate = '2026-07-15';
      request.operationStartYear = entity.operationStartYear;
      request.operationEndYear = entity.operationEndYear;
      request.fspId = entity.fspId;
      request.districtId = entity.districtId;
      request.name = entity.name;
      request.bctsMgrName = entity.bctsMgrName;
      request.description = entity.description;
    }

  });


  describe('isViewAuthorized', () => {
    let entity: Project;
    let user: User;
    const TEST_CLIENT_ID = '1011';

    beforeEach(async () => {
      entity = new Project();
      user = new User();
    });

    it('public user cannot view INITIAL, PUBLISHED, or EXPIRED project', async () => {
      entity.workflowStateCode = WorkflowStateEnum.INITIAL;
      expect(await service.isViewAuthorized(entity, null)).toBe(false);

      entity.workflowStateCode = WorkflowStateEnum.PUBLISHED;
      expect(await service.isViewAuthorized(entity, null)).toBe(false);

      entity.workflowStateCode = WorkflowStateEnum.EXPIRED;
      expect(await service.isViewAuthorized(entity, null)).toBe(false);
    });

    it('public user can view COMMENT_OPEN, COMMENT_CLOSED, and FINALIZED project', async () => {
      entity.workflowStateCode = WorkflowStateEnum.COMMENT_OPEN;
      expect(await service.isViewAuthorized(entity, null)).toBe(true);

      entity.workflowStateCode = WorkflowStateEnum.COMMENT_CLOSED;
      expect(await service.isViewAuthorized(entity, null)).toBe(true);

      entity.workflowStateCode = WorkflowStateEnum.FINALIZED;
      expect(await service.isViewAuthorized(entity, null)).toBe(true);
    });

    it('ministry user can view projects in any state', async () => {
      user.isMinistry = true;

      entity.workflowStateCode = WorkflowStateEnum.INITIAL;
      expect(await service.isViewAuthorized(entity, user)).toBe(true);

      entity.workflowStateCode = WorkflowStateEnum.PUBLISHED;
      expect(await service.isViewAuthorized(entity, user)).toBe(true);

      entity.workflowStateCode = WorkflowStateEnum.EXPIRED;
      expect(await service.isViewAuthorized(entity, user)).toBe(true);

      entity.workflowStateCode = WorkflowStateEnum.COMMENT_OPEN;
      expect(await service.isViewAuthorized(entity, user)).toBe(true);
    });

    it('forestry user for same client can view their own projects in any state', async () => {
      user.isForestClient = true;
      user.clientIds.push(TEST_CLIENT_ID);
      entity.forestClientId = TEST_CLIENT_ID;

      entity.workflowStateCode = WorkflowStateEnum.INITIAL;
      expect(await service.isViewAuthorized(entity, user)).toBe(true);

      entity.workflowStateCode = WorkflowStateEnum.PUBLISHED;
      expect(await service.isViewAuthorized(entity, user)).toBe(true);

      entity.workflowStateCode = WorkflowStateEnum.EXPIRED;
      expect(await service.isViewAuthorized(entity, user)).toBe(true);
    });

    it('forestry user for different client cannot view INITIAL, PUBLISHED, or EXPIRED project', async () => {
      user.isForestClient = true;
      entity.forestClientId = TEST_CLIENT_ID;

      entity.workflowStateCode = WorkflowStateEnum.INITIAL;
      expect(await service.isViewAuthorized(entity, user)).toBe(false);

      entity.workflowStateCode = WorkflowStateEnum.PUBLISHED;
      expect(await service.isViewAuthorized(entity, user)).toBe(false);

      entity.workflowStateCode = WorkflowStateEnum.EXPIRED;
      expect(await service.isViewAuthorized(entity, user)).toBe(false);
    });

    it('forestry user for different client can view public projects', async () => {
      user.isForestClient = true;
      entity.forestClientId = TEST_CLIENT_ID;

      entity.workflowStateCode = WorkflowStateEnum.COMMENT_OPEN;
      expect(await service.isViewAuthorized(entity, user)).toBe(true);

      entity.workflowStateCode = WorkflowStateEnum.COMMENT_CLOSED;
      expect(await service.isViewAuthorized(entity, user)).toBe(true);

      entity.workflowStateCode = WorkflowStateEnum.FINALIZED;
      expect(await service.isViewAuthorized(entity, user)).toBe(true);
    });
  });

  describe('isDeleteAuthorized', () => {
    let entity:Project;
    let user:User;
    const TEST_CLIENT_ID = '1011';

    beforeEach(async () => {
      entity = new Project();
      user = new User();
    })

    it ('public user can not delete', async () => {
      expect(await service.isDeleteAuthorized(entity, null)).toBe(false);
    });

    it ('forest client user can delete when client matches and state initial', async () => {
      user.isForestClient = true;
      user.clientIds.push(TEST_CLIENT_ID);
      entity.forestClientId = TEST_CLIENT_ID;
      entity.workflowStateCode = "INITIAL";
      expect(await service.isDeleteAuthorized(entity, user)).toBe(true);
    });

    it ('forest client user can not delete when state published', async () => {
      user.isForestClient = true;
      user.clientIds.push(TEST_CLIENT_ID);
      entity.forestClientId = TEST_CLIENT_ID;
      entity.workflowStateCode = WorkflowStateEnum.PUBLISHED;
      expect(await service.isDeleteAuthorized(entity, user)).toBe(false);
    });

    it ('ministry user can not delete when state commenting open', async () => {
      user.isMinistry = true;
      entity.workflowStateCode = WorkflowStateEnum.COMMENT_OPEN;
      expect(await service.isDeleteAuthorized(entity, user)).toBe(false);
    });

    it ('ministry user can delete when state commenting closed', async () => {
      user.isMinistry = true;
      entity.workflowStateCode = WorkflowStateEnum.COMMENT_CLOSED;
      expect(await service.isDeleteAuthorized(entity, user)).toBe(true);
    });

  });

  describe('isDistrictExist', () => {
    it('returns false and records the lookup error when the district lookup fails', async () => {
      const logger = mockLoggerFactory();
      const debug = jest.spyOn(logger, 'debug');
      const districtService = { findOne: jest.fn().mockRejectedValue(new Error('missing district')) };
      const localService = new ProjectService(null, logger, districtService as any, null, null, null, null);

      await expect(localService.isDistrictExist(4)).resolves.toBe(false);
      expect(debug).toHaveBeenCalled();
    });

    it('returns false when the district id is missing', async () => {
      await expect(service.isDistrictExist(null)).resolves.toBe(false);
      await expect(service.isDistrictExist(Number.NaN)).resolves.toBe(false);
    });

    it('returns true when the district lookup succeeds', async () => {
      const districtService = { findOne: jest.fn().mockResolvedValue({ id: 4 }) };
      const localService = new ProjectService(null, mockLoggerFactory(), districtService as any, null, null, null, null);
      await expect(localService.isDistrictExist(4)).resolves.toBe(true);
    });
  });

  describe('findAllUnsecured', () => {
    it('logs find options and returns the converted rows', async () => {
      const repository = { find: jest.fn().mockResolvedValue([]) };
      const localService = new ProjectService(repository as any, mockLoggerFactory(), null, null, null, null, null);
      const options = { take: 5 };

      await expect(localService.findAllUnsecured(options as any)).resolves.toEqual([]);
      expect(repository.find).toHaveBeenCalled();
    });
  });

  describe('validateWorkflowTransitionRules', () => {
    let user: User;
    let entity: Partial<Project> = getSampleProjectEntityData();
    let districtSpy: jest.SpyInstance<Promise<boolean>>;
    let postdateOnOrBeforeCommentingOpenDateSpy: jest.SpyInstance<boolean>;
    const stateTransition = WorkflowStateEnum.PUBLISHED;
    let openingDateInFutureDays = 10;
    const closeDateAfterOpeningDateDays = 30;

    describe('"PUBLISHED" transition', () => {
      beforeEach(async () => {
          districtSpy = jest.spyOn(service, 'isDistrictExist').mockResolvedValue(true); // not important, return true for testing.
          postdateOnOrBeforeCommentingOpenDateSpy = jest.spyOn(DateTimeUtil, 'isPNPostdateOnOrBeforeCommentingOpenDate');
          entity.workflowStateCode = "INITIAL";
          entity.projectPlanCode = undefined;
          entity.fspId = 10;
          entity.woodlotLicenseNumber = undefined;
          const proposedSubmission = new Submission();
          proposedSubmission.submissionTypeCode = SubmissionTypeCodeEnum.PROPOSED;
          entity.submissions = [proposedSubmission];
          // FOM entity can only has 1 publicNotice
          const publicNoticeWithNoPostDate = new PublicNotice()
          entity.publicNotices = [publicNoticeWithNoPostDate];
      });

      it('with no public-notice pass', async () => {
        entity.commentingOpenDate = dayjs.tz(DateTimeUtil.nowBC().add(1, 'day'), DateTimeUtil.TIMEZONE_VANCOUVER).format(DateTimeUtil.DATE_FORMAT);
        entity.commentingClosedDate = dayjs.tz(entity.commentingOpenDate, DateTimeUtil.TIMEZONE_VANCOUVER)
            .add(closeDateAfterOpeningDateDays, 'day')
            .format(DateTimeUtil.DATE_FORMAT);
        entity.publicNotices = null; // no public-notice.

        // note, validator is a void.
        await service.validateWorkflowTransitionRules(entity as Project, stateTransition, user)

        // can only detect depedencies (mock/spy) were called on dependency and no error throw for void function.
        expect(districtSpy).toHaveBeenCalled();
        expect(districtSpy).toHaveBeenCalledWith(entity.districtId);
        expect(postdateOnOrBeforeCommentingOpenDateSpy).not.toHaveBeenCalled();
      });

      it('with empty array publicNotices pass', async () => {
        entity.commentingOpenDate = dayjs.tz(DateTimeUtil.nowBC().add(1, 'day'), DateTimeUtil.TIMEZONE_VANCOUVER).format(DateTimeUtil.DATE_FORMAT);
        entity.commentingClosedDate = dayjs.tz(entity.commentingOpenDate, DateTimeUtil.TIMEZONE_VANCOUVER)
            .add(closeDateAfterOpeningDateDays, 'day')
            .format(DateTimeUtil.DATE_FORMAT);
        entity.publicNotices = []; // empty array public-notice.

        await service.validateWorkflowTransitionRules(entity as Project, stateTransition, user);

        expect(districtSpy).toHaveBeenCalled();
        expect(districtSpy).toHaveBeenCalledWith(entity.districtId);
        expect(postdateOnOrBeforeCommentingOpenDateSpy).not.toHaveBeenCalled();
      });
      
      it('with public-notice and no post_date pass', async () => {
        entity.commentingOpenDate = dayjs.tz(DateTimeUtil.nowBC().add(1, 'day'), DateTimeUtil.TIMEZONE_VANCOUVER).format(DateTimeUtil.DATE_FORMAT);
        entity.commentingClosedDate = dayjs.tz(entity.commentingOpenDate, DateTimeUtil.TIMEZONE_VANCOUVER)
            .add(closeDateAfterOpeningDateDays, 'day')
            .format(DateTimeUtil.DATE_FORMAT);
        entity.publicNotices[0].postDate = null; // User leaves post_date empty.

        // note, validator is a void.
        await service.validateWorkflowTransitionRules(entity as Project, stateTransition, user)

        expect(districtSpy).toHaveBeenCalled();
        expect(districtSpy).toHaveBeenCalledWith(entity.districtId);
        expect(postdateOnOrBeforeCommentingOpenDateSpy).not.toHaveBeenCalled();
      });
      
      it('with public-notice post_date same as commenting_open_date pass', async () => {
        entity.commentingOpenDate = dayjs.tz(DateTimeUtil.nowBC().add(1, 'day'), DateTimeUtil.TIMEZONE_VANCOUVER).format(DateTimeUtil.DATE_FORMAT);
        entity.commentingClosedDate = dayjs.tz(entity.commentingOpenDate, DateTimeUtil.TIMEZONE_VANCOUVER)
          .add(closeDateAfterOpeningDateDays, 'day')
          .format(DateTimeUtil.DATE_FORMAT);
        // post_date same as commenting_open_date
        entity.publicNotices[0].postDate = dayjs.tz(entity.commentingOpenDate, DateTimeUtil.TIMEZONE_VANCOUVER).format(DateTimeUtil.DATE_FORMAT);

        // note, validator is a void.
        await service.validateWorkflowTransitionRules(entity as Project, stateTransition, user)

        expect(DateTimeUtil.diff(
          DateTimeUtil.nowBC().format(DateTimeUtil.DATE_FORMAT),
          entity.commentingOpenDate,
          DateTimeUtil.TIMEZONE_VANCOUVER, 'day')
        ).toBeGreaterThanOrEqual(1);
        expect(districtSpy).toHaveBeenCalled();
        expect(districtSpy).toHaveBeenCalledWith(entity.districtId);
        expect(postdateOnOrBeforeCommentingOpenDateSpy).toHaveBeenCalled();
        expect(postdateOnOrBeforeCommentingOpenDateSpy).toHaveBeenCalledWith(
        entity.publicNotices[0].postDate, entity.commentingOpenDate);
      });
      
      it('with public-notice post_date before commenting_open_date and one day after PUBLISH (today) pass', async () => {
        entity.commentingOpenDate = dayjs.tz(DateTimeUtil.nowBC().add(openingDateInFutureDays, 'day'), DateTimeUtil.TIMEZONE_VANCOUVER).format(DateTimeUtil.DATE_FORMAT);
        entity.commentingClosedDate = dayjs.tz(entity.commentingOpenDate, DateTimeUtil.TIMEZONE_VANCOUVER)
          .add(closeDateAfterOpeningDateDays, 'day')
          .format(DateTimeUtil.DATE_FORMAT);
        // set and test on: post_date = commenting_open_date
        entity.publicNotices[0].postDate = dayjs.tz(entity.commentingOpenDate, DateTimeUtil.TIMEZONE_VANCOUVER)
          .subtract(openingDateInFutureDays - 5, 'days')
          .format(DateTimeUtil.DATE_FORMAT);

        await service.validateWorkflowTransitionRules(entity as Project, stateTransition, user)

        expect(DateTimeUtil.diff(
            DateTimeUtil.nowBC().format(DateTimeUtil.DATE_FORMAT),
            entity.publicNotices[0].postDate,
            DateTimeUtil.TIMEZONE_VANCOUVER, 'day')
        ).toBeGreaterThan(1);
        expect(districtSpy).toHaveBeenCalled();
        expect(districtSpy).toHaveBeenCalledWith(entity.districtId);
        expect(postdateOnOrBeforeCommentingOpenDateSpy).toHaveBeenCalled();
        expect(postdateOnOrBeforeCommentingOpenDateSpy).toHaveBeenCalledWith(
          entity.publicNotices[0].postDate, entity.commentingOpenDate
        );
      });

      it('with public-notice post_date greater than commenting_open_date fail', async () => {
        entity.commentingOpenDate = dayjs.tz(
          DateTimeUtil.nowBC().add(openingDateInFutureDays, 'day'), 
          DateTimeUtil.TIMEZONE_VANCOUVER).format(DateTimeUtil.DATE_FORMAT
        );
        entity.commentingClosedDate = dayjs.tz(entity.commentingOpenDate, DateTimeUtil.TIMEZONE_VANCOUVER)
          .add(closeDateAfterOpeningDateDays, 'day')
          .format(DateTimeUtil.DATE_FORMAT);
        // set and test on: post_date = PUBLISH pushed date (today)
        entity.publicNotices[0].postDate = dayjs.tz(entity.commentingOpenDate, DateTimeUtil.TIMEZONE_VANCOUVER)
          .add(1, 'days')
          .format(DateTimeUtil.DATE_FORMAT);

        // Note, to expect an error from async fuction, use ".rejects" before ".toThrow" (strange in jest)
        await expect(() => service.validateWorkflowTransitionRules(entity as Project, stateTransition, user))
          .rejects
          .toThrow(BadRequestException);

        expect(DateTimeUtil.diff(
          entity.commentingOpenDate,
          entity.publicNotices[0].postDate,
          DateTimeUtil.TIMEZONE_VANCOUVER, 'day')
        ).toBeGreaterThan(0);
        expect(districtSpy).toHaveBeenCalled();
        expect(districtSpy).toHaveBeenCalledWith(entity.districtId);
        expect(postdateOnOrBeforeCommentingOpenDateSpy).toHaveBeenCalledTimes(1);
        expect(postdateOnOrBeforeCommentingOpenDateSpy).toHaveBeenCalledWith(
          entity.publicNotices[0].postDate, entity.commentingOpenDate);
      });

      it('with public-notice post_date before PUBLISH date (today) fail', async () => {
        entity.commentingOpenDate = dayjs.tz(DateTimeUtil.nowBC().add(openingDateInFutureDays, 'day'), DateTimeUtil.TIMEZONE_VANCOUVER).format(DateTimeUtil.DATE_FORMAT);
        entity.commentingClosedDate = dayjs.tz(entity.commentingOpenDate, DateTimeUtil.TIMEZONE_VANCOUVER)
          .add(closeDateAfterOpeningDateDays, 'day')
          .format(DateTimeUtil.DATE_FORMAT);
        // set and test on: post_date < PUBLISH pushed date (today)
        entity.publicNotices[0].postDate = dayjs.tz(DateTimeUtil.nowBC().subtract(5, 'days'), DateTimeUtil.TIMEZONE_VANCOUVER)
        .format(DateTimeUtil.DATE_FORMAT);

        // Note, to expect an error from async fuction, use ".rejects" before ".toThrow" (strange in jest)
        await expect(() => service.validateWorkflowTransitionRules(entity as Project, stateTransition, user))
          .rejects
          .toThrow(BadRequestException);

        expect(DateTimeUtil.diff(
          DateTimeUtil.nowBC().format(DateTimeUtil.DATE_FORMAT),
          entity.publicNotices[0].postDate,
          DateTimeUtil.TIMEZONE_VANCOUVER, 'day')
        ).toBeLessThan(0);
        expect(districtSpy).toHaveBeenCalled();
        expect(districtSpy).toHaveBeenCalledWith(entity.districtId);
        expect(postdateOnOrBeforeCommentingOpenDateSpy).toHaveBeenCalledTimes(1);
        expect(postdateOnOrBeforeCommentingOpenDateSpy).toHaveBeenCalledWith(
          entity.publicNotices[0].postDate, entity.commentingOpenDate
        );
      });

      it('with public-notice post_date the same as PUBLISH date (today) fail', async () => {
        // Mock 'today' to a fixed value
        const mockPSTDate = '2025-10-26';
        jest.spyOn(DateTimeUtil, 'nowBC').mockReturnValue(dayjs.tz(mockPSTDate, DateTimeUtil.TIMEZONE_VANCOUVER));

        entity.commentingOpenDate = dayjs().add(openingDateInFutureDays, 'day').format(DateTimeUtil.DATE_FORMAT);
        entity.commentingClosedDate = dayjs(entity.commentingOpenDate)
          .add(closeDateAfterOpeningDateDays, 'day')
          .format(DateTimeUtil.DATE_FORMAT);
        // set and test on: post_date = mocked PUBLISH pushed date (mock PST today)
        entity.publicNotices[0].postDate = mockPSTDate;

        await expect(() => service.validateWorkflowTransitionRules(entity as Project, stateTransition, user))
          .rejects
          .toThrow(BadRequestException);

        expect(DateTimeUtil.diff(
          mockPSTDate,
          entity.publicNotices[0].postDate,
          DateTimeUtil.TIMEZONE_VANCOUVER, 'day')
        ).toEqual(0);
        expect(districtSpy).toHaveBeenCalled();
        expect(districtSpy).toHaveBeenCalledWith(entity.districtId);
        expect(postdateOnOrBeforeCommentingOpenDateSpy).toHaveBeenCalledTimes(1);
        expect(postdateOnOrBeforeCommentingOpenDateSpy).toHaveBeenCalledWith(
          entity.publicNotices[0].postDate, entity.commentingOpenDate);
        jest.restoreAllMocks();
      });

      it('fails when submissions exist but none are PROPOSED', async () => {
        entity.commentingOpenDate = dayjs.tz(DateTimeUtil.nowBC().add(1, 'day'), DateTimeUtil.TIMEZONE_VANCOUVER).format(DateTimeUtil.DATE_FORMAT);
        entity.commentingClosedDate = dayjs.tz(entity.commentingOpenDate, DateTimeUtil.TIMEZONE_VANCOUVER)
            .add(closeDateAfterOpeningDateDays, 'day')
            .format(DateTimeUtil.DATE_FORMAT);
        const finalOnly = new Submission();
        finalOnly.submissionTypeCode = SubmissionTypeCodeEnum.FINAL;
        entity.submissions = [finalOnly];
        entity.publicNotices = null;

        await expect(service.validateWorkflowTransitionRules(entity as Project, stateTransition, user))
          .rejects
          .toThrow('Proposed submission is required');
      });

      it('fails when the district does not exist', async () => {
        districtSpy.mockResolvedValue(false);
        await expect(service.validateWorkflowTransitionRules(entity as Project, stateTransition, user))
          .rejects
          .toThrow('Missing District');
      });

      it('fails when an FSP plan has no FSP id', async () => {
        entity.projectPlanCode = ProjectPlanCodeEnum.FSP;
        entity.fspId = null;
        await expect(service.validateWorkflowTransitionRules(entity as Project, stateTransition, user))
          .rejects
          .toThrow('Missing FSP ID');
      });

      it('fails when an FSP id is not a number', async () => {
        entity.projectPlanCode = ProjectPlanCodeEnum.FSP;
        entity.fspId = Number.NaN;
        await expect(service.validateWorkflowTransitionRules(entity as Project, stateTransition, user))
          .rejects
          .toThrow('Missing FSP ID');
      });

      it('fails when a woodlot plan has no licence number', async () => {
        entity.projectPlanCode = ProjectPlanCodeEnum.WOODLOT;
        entity.woodlotLicenseNumber = null;
        await expect(service.validateWorkflowTransitionRules(entity as Project, stateTransition, user))
          .rejects
          .toThrow('Missing Woodlot License Number');
      });

      it('fails when a woodlot licence number is blank', async () => {
        entity.projectPlanCode = ProjectPlanCodeEnum.WOODLOT;
        entity.woodlotLicenseNumber = '';
        await expect(service.validateWorkflowTransitionRules(entity as Project, stateTransition, user))
          .rejects
          .toThrow('Missing Woodlot License Number');
      });

      it('passes plan-holder checks for a woodlot with a licence number', async () => {
        entity.projectPlanCode = ProjectPlanCodeEnum.WOODLOT;
        entity.woodlotLicenseNumber = 'W1234';
        entity.commentingOpenDate = dayjs.tz(DateTimeUtil.nowBC().add(1, 'day'), DateTimeUtil.TIMEZONE_VANCOUVER).format(DateTimeUtil.DATE_FORMAT);
        entity.commentingClosedDate = dayjs.tz(entity.commentingOpenDate, DateTimeUtil.TIMEZONE_VANCOUVER)
            .add(closeDateAfterOpeningDateDays, 'day')
            .format(DateTimeUtil.DATE_FORMAT);
        entity.publicNotices = null;

        await service.validateWorkflowTransitionRules(entity as Project, stateTransition, user);
      });

      it('fails when commenting open date is missing', async () => {
        entity.commentingOpenDate = null;
        await expect(service.validateWorkflowTransitionRules(entity as Project, stateTransition, user))
          .rejects
          .toThrow('Missing Commenting Open Date');
      });

      it('fails when commenting open date is not at least one day ahead', async () => {
        entity.commentingOpenDate = DateTimeUtil.nowBC().format(DateTimeUtil.DATE_FORMAT);
        entity.commentingClosedDate = dayjs.tz(entity.commentingOpenDate, DateTimeUtil.TIMEZONE_VANCOUVER)
            .add(closeDateAfterOpeningDateDays, 'day')
            .format(DateTimeUtil.DATE_FORMAT);
        await expect(service.validateWorkflowTransitionRules(entity as Project, stateTransition, user))
          .rejects
          .toThrow('at least one day after publish is pushed');
      });

      it('fails when commenting closed date is missing', async () => {
        entity.commentingOpenDate = dayjs.tz(DateTimeUtil.nowBC().add(1, 'day'), DateTimeUtil.TIMEZONE_VANCOUVER).format(DateTimeUtil.DATE_FORMAT);
        entity.commentingClosedDate = null;
        await expect(service.validateWorkflowTransitionRules(entity as Project, stateTransition, user))
          .rejects
          .toThrow('Missing Commenting Closed Date');
      });

      it('fails when commenting closed date is fewer than 30 days after open', async () => {
        entity.commentingOpenDate = dayjs.tz(DateTimeUtil.nowBC().add(1, 'day'), DateTimeUtil.TIMEZONE_VANCOUVER).format(DateTimeUtil.DATE_FORMAT);
        entity.commentingClosedDate = entity.commentingOpenDate;
        await expect(service.validateWorkflowTransitionRules(entity as Project, stateTransition, user))
          .rejects
          .toThrow('at least 30 days after Commenting Open Date');
      });

      it('fails when there are no submissions', async () => {
        entity.commentingOpenDate = dayjs.tz(DateTimeUtil.nowBC().add(1, 'day'), DateTimeUtil.TIMEZONE_VANCOUVER).format(DateTimeUtil.DATE_FORMAT);
        entity.commentingClosedDate = dayjs.tz(entity.commentingOpenDate, DateTimeUtil.TIMEZONE_VANCOUVER)
            .add(closeDateAfterOpeningDateDays, 'day')
            .format(DateTimeUtil.DATE_FORMAT);
        entity.submissions = [];
        await expect(service.validateWorkflowTransitionRules(entity as Project, stateTransition, user))
          .rejects
          .toThrow('Proposed submission is required');
      });

      it('fails when submissions are missing', async () => {
        entity.commentingOpenDate = dayjs.tz(DateTimeUtil.nowBC().add(1, 'day'), DateTimeUtil.TIMEZONE_VANCOUVER).format(DateTimeUtil.DATE_FORMAT);
        entity.commentingClosedDate = dayjs.tz(entity.commentingOpenDate, DateTimeUtil.TIMEZONE_VANCOUVER)
            .add(closeDateAfterOpeningDateDays, 'day')
            .format(DateTimeUtil.DATE_FORMAT);
        entity.submissions = null;
        await expect(service.validateWorkflowTransitionRules(entity as Project, stateTransition, user))
          .rejects
          .toThrow('Proposed submission is required');
      });
    });

    describe('"FINALIZED" transition', () => {
      const finalized = WorkflowStateEnum.FINALIZED;

      function finalizedService(notices: unknown, comments: unknown) {
        const attachmentService = {
          findByProjectIdAndAttachmentTypes: jest.fn().mockResolvedValue(notices),
        };
        const publicCommentService = {
          findByProjectId: jest.fn().mockResolvedValue(comments),
        };
        const local = new ProjectService(
          null, mockLoggerFactory(), null, null, attachmentService as any, publicCommentService as any, null
        );
        jest.spyOn(local, 'isDistrictExist').mockResolvedValue(true);
        return local;
      }

      function readyEntity(): Partial<Project> {
        const ready = { ...getSampleProjectEntityData() };
        const finalSubmission = new Submission();
        finalSubmission.submissionTypeCode = SubmissionTypeCodeEnum.FINAL;
        ready.submissions = [finalSubmission];
        ready.commentClassificationMandatory = false;
        return ready;
      }

      it('fails when there is no final submission', async () => {
        const local = finalizedService([{ id: 1 }], []);
        const ready = readyEntity();
        ready.submissions = [new Submission()];
        await expect(local.validateWorkflowTransitionRules(ready as Project, finalized, new User()))
          .rejects
          .toThrow('Final Submission is required');
      });

      it('fails when submissions are missing', async () => {
        const local = finalizedService([{ id: 1 }], []);
        const ready = readyEntity();
        ready.submissions = null;
        await expect(local.validateWorkflowTransitionRules(ready as Project, finalized, new User()))
          .rejects
          .toThrow('Final Submission is required');
      });

      it('fails when no public notice is attached', async () => {
        const local = finalizedService([], []);
        await expect(local.validateWorkflowTransitionRules(readyEntity() as Project, finalized, new User()))
          .rejects
          .toThrow('Public Notice is required');
      });

      it('fails when the public notice lookup returns nothing', async () => {
        const local = finalizedService(null, []);
        await expect(local.validateWorkflowTransitionRules(readyEntity() as Project, finalized, new User()))
          .rejects
          .toThrow('Public Notice is required');
      });

      it('passes when comment classification is not mandatory', async () => {
        const local = finalizedService([{ id: 1 }], null);
        await local.validateWorkflowTransitionRules(readyEntity() as Project, finalized, new User());
      });

      it('passes when classification is mandatory and there are no comments', async () => {
        const local = finalizedService([{ id: 1 }], []);
        const ready = readyEntity();
        ready.commentClassificationMandatory = true;
        await local.validateWorkflowTransitionRules(ready as Project, finalized, new User());
      });

      it('fails when classification is mandatory and a comment is unclassified', async () => {
        const local = finalizedService([{ id: 1 }], [{ response: null }]);
        const ready = readyEntity();
        ready.commentClassificationMandatory = true;
        await expect(local.validateWorkflowTransitionRules(ready as Project, finalized, new User()))
          .rejects
          .toThrow('All comments must be classified');
      });

      it('passes when classification is mandatory and every comment is classified', async () => {
        const local = finalizedService([{ id: 1 }], [{ response: { code: 'CONSIDERED' } }]);
        const ready = readyEntity();
        ready.commentClassificationMandatory = true;
        await local.validateWorkflowTransitionRules(ready as Project, finalized, new User());
      });
    });

  });

  describe('workflowStateChange', () => {
    let workflowService: ProjectService;
    let mockRepository: any;
    let mockMailService: any;
    let user: User;
    let request: ProjectWorkflowStateChangeRequest;
    let sampleEntity: Project;

    beforeEach(() => {
      mockRepository = {
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      mockMailService = {
        sendDistrictNotification: jest.fn().mockResolvedValue(undefined),
      };
      workflowService = new ProjectService(
        mockRepository as any,
        mockLoggerFactory(),
        null,
        null,
        null,
        null,
        mockMailService as any
      );

      user = new User();
      user.isForestClient = true;
      user.userName = 'testuser';
      user.clientIds = ['00001012'];

      request = new ProjectWorkflowStateChangeRequest();
      request.revisionCount = 1;
      request.workflowStateCode = WorkflowStateEnum.FINALIZED;

      sampleEntity = new Project();
      sampleEntity.id = 1001;
      sampleEntity.revisionCount = 1;
      sampleEntity.forestClientId = '00001012';
      sampleEntity.workflowStateCode = WorkflowStateEnum.COMMENT_CLOSED;
      sampleEntity.district = { id: 1, name: 'Cascades Natural Resource District' } as any;

      jest.spyOn(workflowService as any, 'findEntityWithCommonRelations').mockResolvedValue(sampleEntity);
      jest.spyOn(workflowService, 'validateWorkflowTransitionRules').mockResolvedValue(undefined);
      jest.spyOn(workflowService, 'convertEntity').mockReturnValue(new ProjectResponse());
    });

    it('sends district notification email via mailService when transitioning to FINALIZED', async () => {
      await workflowService.workflowStateChange(1001, request, user);

      expect(mockRepository.update).toHaveBeenCalledWith(1001, expect.objectContaining({
        workflowStateCode: WorkflowStateEnum.FINALIZED,
        revisionCount: 2,
        updateUser: 'testuser',
      }));
      expect(mockMailService.sendDistrictNotification).toHaveBeenCalledTimes(1);
      expect(mockMailService.sendDistrictNotification).toHaveBeenCalledWith(sampleEntity);
    });

    it('throws InternalServerErrorException when sending district notification email fails', async () => {
      mockMailService.sendDistrictNotification.mockRejectedValue(new Error('SMTP connection failure'));

      await expect(workflowService.workflowStateChange(1001, request, user))
        .rejects
        .toThrow(new InternalServerErrorException('Problem sending FOM finalized notification email.'));
    });

    it('does not send notification email when transitioning to a non-FINALIZED state', async () => {
      sampleEntity.workflowStateCode = WorkflowStateEnum.INITIAL;
      request.workflowStateCode = WorkflowStateEnum.PUBLISHED;
      jest.spyOn(workflowService as any, 'updatePublicNoticeIfRequired').mockResolvedValue(undefined);

      await workflowService.workflowStateChange(1001, request, user);

      expect(mockRepository.update).toHaveBeenCalledWith(1001, expect.objectContaining({
        workflowStateCode: WorkflowStateEnum.PUBLISHED,
      }));
      expect(mockMailService.sendDistrictNotification).not.toHaveBeenCalled();
    });
  });

  function getSampleProjectEntityData(): Partial<Project> {
    const data =  
    {
      "id": 1,
      "name": "Project #1",
      "description": "Project #1",
      "commentingOpenDate": "2022-08-01",
      "commentingClosedDate": "2027-07-29",
      "validityEndDate": "2052-12-31",
      "fspId": 10,
      "districtId": 10,
      "forestClientId": "00001012",
      "workflowState": {
        "factory": null, // Temporarily added here but not used for testing, without this ts will have complaint.
        "code": "COMMENT_OPEN",
        "description": "Commenting Open"
      },
      "revisionCount": 1,
      "commentClassificationMandatory": false,
      "publicNoticeId": 10001
    }
    return data;
  }

/*  Example of creating a mock module.
  let repository: Repository<Project>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        // Config
        AppConfigModule,
        TypeOrmModule.forRootAsync({
          imports: [AppConfigModule],
          useFactory: (configService: AppConfigService) => {
            return {
              autoLoadEntities: true,
              type: configService.db('type'),
              name: configService.db('username'),
              password: configService.db('password'),
              database: configService.db('database'),
              schema: 'app_fom',
              host: configService.db('host'),
              entities: configService.db('entities'),
              synchronize: configService.db('synchronize'),
              ssl: configService.db('ssl'),
              useUnifiedTopology: true,
              useNewUrlParser: true,
            };
          },
          inject: [AppConfigService],
        }),
      ],
      providers: [
        {
          provide: getRepositoryToken(Project),
          useClass: Repository,
        },
        { provide: PinoLogger, useValue: mockLoggerFactory() },
        // ProjectService,
      ],
    }).compile();

    repository = getRepository(Project);

    const logger = module.get(PinoLogger);
    service = new ProjectService(repository, logger, new DistrictService(null, logger), new ForestClientService(null, logger));
  });

*/
});
