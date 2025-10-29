import { DateTimeUtil } from "@api-core/dateTimeUtil";
import { ProjectCreateRequest, ProjectUpdateRequest } from '@api-modules/project/project.dto';
import { Project } from '@api-modules/project/project.entity';
import { ProjectService } from '@api-modules/project/project.service';
import { PublicNotice } from "@api-modules/project/public-notice.entity";
import { WorkflowStateEnum } from '@api-modules/project/workflow-state-code.entity';
import { Submission } from "@api-modules/submission/submission.entity";
import { BadRequestException } from "@nestjs/common";
import { User } from "@utility/security/user";
import * as dayjs from 'dayjs';
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

  });


  describe('isViewAuthorized', () => {
    let entity:Project;
    let user:User;
    const TEST_CLIENT_ID = '1011';

    beforeEach(async () => {
      entity = new Project();
      user = new User();
    })

    it ('public user can view', async () => {
      expect(await service.isViewAuthorized(entity, null)).toBe(true);
    });
    it ('ministry user can view', async () => {
      user.isMinistry = true;
      expect(await service.isViewAuthorized(entity, user)).toBe(true);
    });
    it ('forestry user for different client cannot view', async () => {
      user.isForestClient = true;
      entity.forestClientId = TEST_CLIENT_ID;
      expect(await service.isViewAuthorized(entity, user)).toBe(false);
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
          entity.submissions = [new Submission()] // setup only, not important.
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
