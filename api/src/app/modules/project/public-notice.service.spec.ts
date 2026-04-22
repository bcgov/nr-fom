import { ProjectService } from "@api-modules/project/project.service";
import { PublicNotice } from "@api-modules/project/public-notice.entity";
import { PublicNoticeService } from "@api-modules/project/public-notice.service";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { User } from "@utility/security/user";
import { PinoLogger } from "nestjs-pino";
import { DataSource, Repository } from "typeorm";
import { ProjectResponse } from "./project.dto";
import { PublicNoticeCreateRequest, PublicNoticePublicFrontEndResponse } from "./public-notice.dto";
import { WorkflowStateEnum } from "./workflow-state-code.entity";

describe('PublicNoticeService', () => {
    let service: PublicNoticeService;
    let projectService: ProjectService;
    let repository: Repository<PublicNotice>;
    let request: PublicNoticeCreateRequest;
    let user: User;

    beforeAll(async () => {
        const moduleRef: TestingModule = await Test.createTestingModule({
          providers: provideDependencyMock()
        }).compile();

        projectService = moduleRef.get<ProjectService>(ProjectService);
        service = moduleRef.get<PublicNoticeService>(PublicNoticeService);
        repository = moduleRef.get(getRepositoryToken(PublicNotice));
    });

    // This is prerequisite to make sure services/repository are setup for testing.
    it('Services/repository for testing should be defined', () => {
        expect(service).toBeDefined();
        expect(projectService).toBeDefined();
        expect(repository).toBeDefined();
    });

    describe('isCreateAuthorized', () => {
      beforeEach(async () => {
        user = new User();
        request = new PublicNoticeCreateRequest();
      });

      it('public user cannot create', async () => {
        expect(await service.isCreateAuthorized(request, null)).toBe(false);
      });
      
      it('project contains public notice, cannot create', async () => {
        const projectResponseData: any = getSimpleProjectResponseData();
        request.projectId = (projectResponseData as ProjectResponse).id;
        const projectServiceSpy = jest.spyOn(projectService, 'findOne').mockResolvedValue(projectResponseData);

        const testResult = await service.isCreateAuthorized(request, user);

        expect(testResult).toBeFalsy();
        expect(projectServiceSpy).toHaveBeenCalledWith(request.projectId, user);
      });

      it.each([
        WorkflowStateEnum.PUBLISHED, 
        WorkflowStateEnum.COMMENT_OPEN, 
        WorkflowStateEnum.COMMENT_CLOSED, 
        WorkflowStateEnum.FINALIZED, 
        WorkflowStateEnum.EXPIRED])
      ('cannot create public notice for project status other than "INITIAL"', 
      async (testWorkflowStateCode) => {
        const projectResponseData: ProjectResponse = getSimpleProjectResponseData();
        projectResponseData.id = 2;
        projectResponseData.publicNoticeId = undefined; // no public_notice exists for projectId = 2, so can be created;
        projectResponseData.workflowState.code = testWorkflowStateCode; // can't create with this status.
        const projectServiceSpy = jest.spyOn(projectService, 'findOne').mockResolvedValue(projectResponseData);
        request.projectId = projectResponseData.id;

        const testResult = await service.isCreateAuthorized(request, user);

        expect(projectResponseData.workflowState.code).toBe(testWorkflowStateCode);
        expect(testResult).toBeFalsy();
        expect(projectServiceSpy).toHaveBeenCalledWith(request.projectId, user);
      });

      it('cannot create public notice for project status "INITIAL" with wrong forest-client', 
      async () => {
        const projectResponseData: ProjectResponse = getSimpleProjectResponseData();
        projectResponseData.id = 2;
        projectResponseData.publicNoticeId = undefined; // no public_notice exists for projectId = 2, so can be created;
        projectResponseData.workflowState.code = WorkflowStateEnum.INITIAL; // can create with this status.
        const wrongForestClientId = 'wrong-id';
        projectResponseData.forestClient.id = wrongForestClientId;
        const projectServiceSpy = jest.spyOn(projectService, 'findOne').mockResolvedValue(projectResponseData);
        user.isForestClient = true;
        const userSpy = jest.spyOn((user as any), 'isAuthorizedForClientId').mockReturnValue(false); // this client is not authorized.
        request.projectId = projectResponseData.id;

        const testResult = await service.isCreateAuthorized(request, user);

        expect(testResult).toBeFalsy();
        expect(projectServiceSpy).toHaveBeenCalledWith(request.projectId, user);
        expect(userSpy).toHaveBeenCalledWith(wrongForestClientId);
      });

      it('can create public notice for project status "INITIAL" with right forest-client', 
      async () => {
        const projectResponseData: ProjectResponse = getSimpleProjectResponseData();
        projectResponseData.id = 2;
        projectResponseData.publicNoticeId = undefined; // no public_notice exists for projectId = 2, so can be created;
        projectResponseData.workflowState.code = WorkflowStateEnum.INITIAL; // can create with this status.
        const projectServiceSpy = jest.spyOn(projectService, 'findOne').mockResolvedValue(projectResponseData);
        user.isForestClient = true;
        const userSpy = jest.spyOn((user as any), 'isAuthorizedForClientId').mockReturnValue(true);
        request.projectId = projectResponseData.id;

        const testResult = await service.isCreateAuthorized(request, user);

        expect(testResult).toBeTruthy();
        expect(projectServiceSpy).toHaveBeenCalledWith(request.projectId, user);
        expect(userSpy).toHaveBeenCalledWith(projectResponseData.forestClient.id);
      });
    });

    describe('isViewAuthorized', () => {
      beforeEach(async () => {
        user = new User();
        request = new PublicNoticeCreateRequest();
      });

      it('public user cannot view detail public notice', async () => {
        expect(await service.isViewAuthorized(new PublicNotice(), null)).toBe(false);
      });

      it('ministry user can view detail public notice', async () => {
        user.isMinistry = true;
        const entity = new PublicNotice();
        const samplePublicNoticeResponseData = getSimplePublicNoticePublicFrontEndResponseData()[0];
        entity.projectId = samplePublicNoticeResponseData.projectId;
        const projectServiceSpy = jest.spyOn(projectService, 'findOne').mockResolvedValue(new ProjectResponse());

        const result = await service.isViewAuthorized(entity, user);

        expect(result).toBeTruthy();
        expect(projectServiceSpy).toHaveBeenCalledWith(entity.projectId, user);
      });

      it('invalid forest client cannot view detail public notice', async () => {
        user.isForestClient = true;
        user.clientIds = ['invalid-client-id'];
        const entity = new PublicNotice();
        const projectResponseData = getSimpleProjectResponseData();
        entity.projectId = projectResponseData.id;
        const userSpy = jest.spyOn(user, 'isAuthorizedForClientId');
        const projectResponse = new ProjectResponse();
        projectResponse.id = entity.projectId;
        projectResponse.forestClient = projectResponseData.forestClient;
        const projectServiceSpy = jest.spyOn(projectService, 'findOne').mockResolvedValue(projectResponse);

        const result = await service.isViewAuthorized(entity, user);

        expect(result).toBeFalsy();
        expect(projectServiceSpy).toHaveBeenCalledWith(entity.projectId, user);
        expect(userSpy).toHaveBeenCalledWith(projectResponseData.forestClient.id);
      });

      it('valid forest client can view detail public notice', async () => {
        const projectResponseData = getSimpleProjectResponseData();
        user.isForestClient = true;
        user.clientIds = [projectResponseData.forestClient.id];
        const entity = new PublicNotice();
        entity.projectId = projectResponseData.id;
        const userSpy = jest.spyOn(user, 'isAuthorizedForClientId');
        const projectResponse = new ProjectResponse();
        projectResponse.id = entity.projectId;
        projectResponse.forestClient = projectResponseData.forestClient;
        const projectServiceSpy = jest.spyOn(projectService, 'findOne').mockResolvedValue(projectResponse);

        const result = await service.isViewAuthorized(entity, user);

        expect(result).toBeTruthy();
        expect(projectServiceSpy).toHaveBeenCalledWith(entity.projectId, user);
        expect(userSpy).toHaveBeenCalledWith(projectResponseData.forestClient.id);
      });

    });

    describe('findForPublicFrontEnd', () => {

      it('return cache Public Notices when cache still presents', async () => {
        const cacheResult: Array<PublicNoticePublicFrontEndResponse> = getSimplePublicNoticePublicFrontEndResponseData();
        const cacheSpy = jest.spyOn((service as any).cache, 'get').mockImplementation(jest.fn((_x) => cacheResult));

        const testResult = await service.findForPublicFrontEnd();

        expect(testResult).toBe(cacheResult);
        expect(cacheSpy).toHaveBeenCalledWith(service.cacheKey);
      });

      it('return new Public Notices when no cache', async () => {
        const cacheSpy = jest.spyOn((service as any).cache, 'get').mockImplementation(jest.fn((_x) => null)); // no cache.
        const publicNoticeEntityData = getSamplePublicNoticeEntity();
        const projectResponseData = getSimpleProjectResponseData();
        const createQueryBuilder: any = {
          leftJoinAndSelect: () => createQueryBuilder,
          where: () => createQueryBuilder,
          andWhere: () => createQueryBuilder,
          orWhere: () => createQueryBuilder,
          addOrderBy: () => createQueryBuilder,
          getMany: () => [publicNoticeEntityData],
        };
        const createQueryBuilderSpy = jest.spyOn(repository, 'createQueryBuilder').mockImplementation(() => createQueryBuilder);
        const serviceSpy = jest.spyOn(service, 'convertEntity').mockImplementation((_x) => _x);
        const projectServiceSpy = jest.spyOn(projectService, 'convertEntity').mockReturnValue(projectResponseData);

        const testResult = await service.findForPublicFrontEnd();

        expect(cacheSpy).toHaveBeenCalledWith(service.cacheKey);
        expect(createQueryBuilderSpy).toHaveBeenCalled();
        expect(serviceSpy).toHaveBeenCalledWith(publicNoticeEntityData);
        expect(projectServiceSpy).toHaveBeenCalledWith(publicNoticeEntityData.project);
        expect(JSON.stringify(testResult[0])).toBe(JSON.stringify(getSimplePublicNoticePublicFrontEndResponseData()[0]));
      });

    });

});

export class PublicNoticeRepositoryFake {
  public createQueryBuilder(): void {
    // This is intentional for empty body.
  }
}

function provideDependencyMock(): Array<any> {
  const dependencyMock =  
    [ PublicNoticeService,
      {
        provide: getRepositoryToken(PublicNotice),
        useClass: PublicNoticeRepositoryFake
      },
      {
        provide: PinoLogger,
        useValue: {
          info: jest.fn((_x) => _x),
          setContext: jest.fn((_x) => _x),
        }
      },
      {
        provide: ProjectService,
        useValue: {
          findOne: jest.fn(),
          convertEntity: jest.fn()
        }
      },
      {
        provide: DataSource,
        useValue: {
            getRepository: jest.fn()
        }
      }
    ];
  return dependencyMock;
}

function getSimplePublicNoticeCreateRequestData() {
  const data = {
    "projectId": 1,
    "reviewAddress": "#1 some review address",
    "reviewBusinessHours": "1 to 5 pm Friday",
    "receiveCommentsAddress": "#1 some receive comment address",
    "receiveCommentsBusinessHours": "9 to 12 am Monday to Friday",
    "isReceiveCommentsSameAsReview": true,
    "mailingAddress": "#1 some mailing address",
    "email": "a1@test.com"
  };
  return data;
}

function getSimpleProjectResponseData(): ProjectResponse {
  const data =  
  {
    "id": 1,
    "name": "Project #1",
    "description": "Project #1",
    "commentingOpenDate": "2022-08-01",
    "commentingClosedDate": "2027-07-29",
    "validityEndDate": "2052-12-31",
    "projectPlanCode": "FSP",
    "fspId": 10,
    "district": {
      "id": 21,
      "name": "Thompson Rivers"
    },
    "forestClient": {
      "id": "00001012",
      "name": "BELL LUMBER & POLE CANADA, ULC"
    },
    "workflowState": {
      "factory": null, // Temporarily added here, without this ts will have complaint. Probably due to type is an entity, not dto.
      "code": "COMMENT_OPEN",
      "description": "Commenting Open"
    },
    "revisionCount": 1,
    "createTimestamp": "2022-08-29 20:18:37.921048+00",
    "commentClassificationMandatory": false,
    "publicNoticeId": 10001,
    "operationStartYear": 2028,
    "operationEndYear": 2031,
    "bctsMgrName": null
  }
  return data;
}

function getSimplePublicNoticePublicFrontEndResponseData() { 
  const data = [
    {
      ...getSimplePublicNoticeCreateRequestData(),
      "project": {...getSimpleProjectResponseData()}
    }
  ];
  return data;
}

function getSamplePublicNoticeEntity() {
  const pncr : PublicNoticePublicFrontEndResponse = getSimplePublicNoticePublicFrontEndResponseData()[0];
  const entity = {
    id: pncr.project.publicNoticeId,
    projectId: pncr.projectId,
    reviewAddress: pncr.reviewAddress,
    reviewBusinessHours: pncr.reviewBusinessHours,
    receiveCommentsAddress: pncr.receiveCommentsAddress,
    receiveCommentsBusinessHours: pncr.receiveCommentsBusinessHours,
    isReceiveCommentsSameAsReview: pncr.isReceiveCommentsSameAsReview,
    mailingAddress: pncr.mailingAddress,
    email: pncr.email,
    revisionCount: 1,
    project: {
      id: pncr.project.id,
      fspId: pncr.project.fspId,
      name: pncr.project.name,
      revisionCount: pncr.project.revisionCount,
      workflowState: pncr.project.workflowState,
      publicNotices: [{id:pncr.project.publicNoticeId}],
      operationStartYear: pncr.project.operationStartYear,
      operationEndYear: pncr.project.operationEndYear
    }
  } as PublicNotice;
  return entity;
}