import { DateTimeUtil } from '@api-core/dateTimeUtil';
import { Project } from '@api-modules/project/project.entity';
import { ProjectService } from '@api-modules/project/project.service';
import {
    PublicNoticeCreateRequest, PublicNoticePublicFrontEndResponse,
    PublicNoticeResponse, PublicNoticeUpdateRequest
} from '@api-modules/project/public-notice.dto';
import { DataService } from '@core';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from '@nestjs/typeorm';
import { User } from "@utility/security/user";
import * as dayjs from 'dayjs';
import { PinoLogger } from 'nestjs-pino';
import * as R from 'remeda';
import { Brackets, Repository } from 'typeorm';
import { PublicNotice } from '@api-modules/project/public-notice.entity';
import { WorkflowStateEnum } from '@api-modules/project/workflow-state-code.entity';
import * as NodeCacheModule from 'node-cache';
import * as _ from 'lodash';
const NodeCache = (NodeCacheModule as any).default || NodeCacheModule;

@Injectable()
export class PublicNoticeService extends DataService<PublicNotice, Repository<PublicNotice>, PublicNoticeResponse> {

  constructor(
    @InjectRepository(PublicNotice)
    repository: Repository<PublicNotice>,
    logger: PinoLogger,
    private projectService: ProjectService
  ) {
    super(repository, new PublicNotice(), logger);
  }

  private cache = new NodeCache({ useClones: false});
  readonly cacheKey = 'PublicNotices';

  @Cron('55 9 * * * ') // Run at 09:55 UTC each day, after the batch to update states at 09:00 UTC, and shortly after the project cache refresh at 09:45 UTC.
  async resetCache() {
    this.logger.info("Refresh cache for public notices...");
    this.cache.flushAll();
    await this.refreshCache();
  }

  async refreshCache():Promise<any> {
    await this.findForPublicFrontEnd();
  }

  async isCreateAuthorized(dto: PublicNoticeCreateRequest, user?: User): Promise<boolean> {
    if (!user) {
      return false;
    }
    const projectResponse = await this.projectService.findOne(dto.projectId, user);
     // If a public notice already exists for a project then prevent a new one from being created.
    if (projectResponse.publicNoticeId) {
      return false;
    }

    return (WorkflowStateEnum.INITIAL == projectResponse.workflowState.code) &&
            user.isForestClient && 
            user.isAuthorizedForClientId(projectResponse.forestClient.id);
  }
  
  async isUpdateAuthorized(_dto: PublicNoticeUpdateRequest, entity: PublicNotice, user?: User): Promise<boolean> {
    if (!user) {
      return false;
    }

    const projectResponse = await this.projectService.findOne(entity.projectId, user);

    if (!user.isForestClient || !user.isAuthorizedForClientId(projectResponse.forestClient.id)) {
      return false;
    }

    if (![WorkflowStateEnum.INITIAL].includes(projectResponse.workflowState.code as WorkflowStateEnum)) {
      return false;
    }

    return true;
  }

  async isDeleteAuthorized(entity: PublicNotice, user?: User): Promise<boolean> {
    if (!user) {
      return false;
    }

    // Only scenario when forest client user can delete.
    const projectResponse = await this.projectService.findOne(entity.projectId, user);
    if (projectResponse.workflowState.code == WorkflowStateEnum.INITIAL) {
      return user.isForestClient && user.isAuthorizedForClientId(projectResponse.forestClient.id);
    }

    return false;
  }

  async isViewAuthorized(entity: PublicNotice, user?: User): Promise<boolean> {
    if (!user) {
      return false;
    }

    const projectResponse = await this.projectService.findOne(entity.projectId, user);
    return user.isMinistry || (user.isForestClient && 
      user.isAuthorizedForClientId(projectResponse.forestClient.id));
  }

  async findForPublicFrontEnd():Promise<PublicNoticePublicFrontEndResponse[]> {

    const cacheResult = this.cache.get(this.cacheKey);
    if (cacheResult != undefined) {
      return cacheResult as PublicNoticePublicFrontEndResponse[];
    }
    const query = this.repository.createQueryBuilder("pn")
      .leftJoinAndSelect("pn.project", "p")
      .leftJoinAndSelect("p.forestClient", "forestClient")
      .leftJoinAndSelect("p.district", "district")
			// public notices posted earlier than commenting open (in published state with post_date on before today).
			.where(new Brackets(qb => {
				qb.where("p.workflow_state_code =:workflowStateCode", {workflowStateCode: WorkflowStateEnum.PUBLISHED})
				.andWhere("pn.post_date <=:today", {today: DateTimeUtil.nowBC().toDate().toISOString()})
			}))
			// public notices for commenting open.
			.orWhere("p.workflow_state_code IN (:...workflowStateCodes)",
				{ workflowStateCodes: [WorkflowStateEnum.COMMENT_OPEN]})
      .addOrderBy('p.project_id', 'DESC'); // Newest first

    const entityResult: PublicNotice[] = await query.getMany();
    const results = entityResult.map(entity => {
      const response = new PublicNoticePublicFrontEndResponse();
      const pnr = this.convertEntity(entity);
      Object.assign(response, R.pick(pnr, 
        [
          'projectId',
          'reviewAddress',
          'reviewBusinessHours',
          'receiveCommentsAddress',
          'receiveCommentsBusinessHours',
          'isReceiveCommentsSameAsReview',
          'mailingAddress',
          'email',
          'postDate'
        ]
      ));
      response.project = this.projectService.convertEntity(entity.project);
      return response;
    });

    // Public notice data visible to public only changes daily with batch update process, so we let cached data persist for 24 hours, and have scheduled logic
    // to reset the cache shortly after the batch runs.
    const ttl = 24*60*60; // 24 hours
    this.cache.set(this.cacheKey, results, ttl);
    return results;
  }

  async findLatestPublicNotice(forestClientId: string, user: User): Promise<PublicNoticeResponse> {
    if (!user || !user.isAuthorizedForAdminSite() || !user.isAuthorizedForClientId(forestClientId)) {
      throw new ForbiddenException();
    }

    const qResult = await this.repository.createQueryBuilder('pn')
    .select('pn')
    .addSelect(`greatest(pn.createTimestamp, pn.updateTimestamp)`, 'pn_timestamp')
    .innerJoin('Project', 'pj', 'pj.id = pn.projectId')
    .where('pj.forestClientId = :forestClientId ', {forestClientId})
    .addOrderBy('pn_timestamp', 'DESC')
    .limit(1)
    .getOne() as Partial<PublicNotice>;

    if (!qResult) {
      return null;
    }

    return this.convertEntity(qResult as PublicNotice);
  }

  convertEntity(entity: PublicNotice): PublicNoticeResponse {
    const response = new PublicNoticeResponse();
    response.id = entity.id;
    response.projectId = entity.projectId;
    response.reviewAddress = entity.reviewAddress;
    response.reviewBusinessHours = entity.reviewBusinessHours;
    response.receiveCommentsAddress = entity.receiveCommentsAddress;
    response.receiveCommentsBusinessHours = entity.receiveCommentsBusinessHours;
    response.isReceiveCommentsSameAsReview = entity.isReceiveCommentsSameAsReview;
    response.mailingAddress = entity.mailingAddress;
    response.email = entity.email;
    response.revisionCount = entity.revisionCount;
    response.postDate = entity.postDate;
    return response;
  }

	// Override: for some dto property business values check.
	async convertDto(dto: PublicNoticeCreateRequest) {

		// find project info
		const commentingOpenDate: string = dayjs((await this.getDataSource().getRepository(Project)
			.createQueryBuilder()
			.select("commenting_open_date")
			.where("project_id = :projectId", {projectId: dto.projectId})
			.getRawOne())['commenting_open_date']).format(DateTimeUtil.DATE_FORMAT);
		const postDate = dto.postDate;
		
		// postDate validation: on or before commenting start date.
		if (postDate && !DateTimeUtil.isPNPostdateOnOrBeforeCommentingOpenDate(postDate, commentingOpenDate)) {
			throw new BadRequestException(`Online Public Notice post date ${postDate} 
				should be on or before commenting start date ${commentingOpenDate}.`);
		}

		return super.convertDto(dto);
	}
}