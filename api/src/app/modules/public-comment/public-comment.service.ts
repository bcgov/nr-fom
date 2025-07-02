import { DataService } from '@core';
import { DeepPartial } from '@entities';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@utility/security/user';
import * as _ from 'lodash';
import { PinoLogger } from 'nestjs-pino';
import { FindOneOptions, Repository, UpdateResult } from 'typeorm';
import { ProjectAuthService } from '../project/project-auth.service';
import { WorkflowStateEnum } from '../project/workflow-state-code.entity';
import {
  PublicCommentAdminResponse,
  PublicCommentAdminUpdateRequest,
  PublicCommentCreateRequest,
  PublicCommentCountByDistrictResponse,
  PublicCommentCountByCategoryResponse,
  PublicCommentCountByProjectResponse,
} from './public-comment.dto';
import { PublicComment } from './public-comment.entity';
import { applyCommentCreateDateFilter } from '@api-modules/analytics-dashboard/analytics-dashboard-data-filter';

@Injectable()
export class PublicCommentService extends DataService<
  PublicComment,
  Repository<PublicComment>,
  PublicCommentAdminResponse
> {
  private readonly key = process.env.DATA_ENCRYPTION_KEY || 'defaultkey';

  constructor(
    @InjectRepository(PublicComment)
    repository: Repository<PublicComment>,
    logger: PinoLogger,
    private projectAuthService: ProjectAuthService
  ) {
    super(repository, new PublicComment(), logger);
  }

  protected async saveEntity(
    model: DeepPartial<PublicComment>
  ): Promise<PublicComment> {
    const encryptColumns = ['name', 'location', 'email', 'phoneNumber']; // entity property names that need to be encrypted.
    const encrypColumntPicked = _.pick(model, encryptColumns);
    const encryptColumnsOmitted = _.omit(model, encryptColumns);
    let created = await super.saveEntity(encryptColumnsOmitted);
    created = { ...created, ...encrypColumntPicked } as PublicComment;
    await this.encryptSensitiveColumns(created);
    return created;
  }

  protected async updateEntity(
    id: string | number,
    dto: any,
    entity: PublicComment
  ): Promise<UpdateResult> {
    // There's no use case to update encrypted columns, so we don't touch them - they'll be loaded as encrypted, and resaved as encrypted.
    return super.updateEntity(id, dto, entity);
  }

  protected async findEntityWithCommonRelations(
    id: string | number,
    options?: FindOneOptions<PublicComment> | undefined
  ) {
    const found = await super.findEntityWithCommonRelations(id);
    if (found == undefined) {
      return found;
    }
    const decryptedPartials = await this.obtainDecryptedColumns([found.id]);
    if (decryptedPartials) {
      Object.assign(found, decryptedPartials[0]);
    }
    return found;
  }

  protected convertEntity(entity: PublicComment): PublicCommentAdminResponse {
    const response = new PublicCommentAdminResponse();
    response.commentScope = entity.commentScope;
    response.createTimestamp = entity.createTimestamp.toISOString();
    response.email = entity.email;
    response.feedback = entity.feedback;
    response.id = entity.id;
    response.location = entity.location;
    response.name = entity.name;
    response.phoneNumber = entity.phoneNumber;
    response.projectId = entity.projectId;
    response.response = entity.response;
    response.responseDetails = entity.responseDetails;
    response.revisionCount = entity.revisionCount;
    response.scopeCutBlockId = entity.scopeCutBlockId;
    response.scopeRoadSectionId = entity.scopeRoadSectionId;
    response.scopeFeatureName =
      entity.cutBlock?.name || entity.roadSection?.name || ''; // 'name' field from cutBlock or roadSection.

    return response;
  }

  protected getCommonRelations(): string[] {
    return ['commentScope', 'response', 'cutBlock', 'roadSection'];
  }

  private async encryptSensitiveColumns(entity: PublicComment) {
    this.logger.debug('Encrypting sensitive columns for PublicComment...');
    // Do update: pgp encrypt sensitive column values
    await this.repository.update(entity.id, {
      ...(entity.name && {
        name: () => `pgp_sym_encrypt('${entity.name}', '${this.key}')`,
      }),
      ...(entity.location && {
        location: () => `pgp_sym_encrypt('${entity.location}', '${this.key}')`,
      }),
      ...(entity.email && {
        email: () => `pgp_sym_encrypt('${entity.email}', '${this.key}')`,
      }),
      ...(entity.phoneNumber && {
        phoneNumber: () =>
          `pgp_sym_encrypt('${entity.phoneNumber}', '${this.key}')`,
      }),
    });
  }

  private async obtainDecryptedColumns(
    id: number[]
  ): Promise<Partial<PublicComment>[]> {
    this.logger.debug('Decrypting sensitive columns for PublicComment...');
    // using query builder for select back
    return (await this.repository
      .createQueryBuilder('pc')
      .select('public_comment_id', 'id')
      .addSelect(`pgp_sym_decrypt(name::bytea, '${this.key}')`, 'name')
      .addSelect(`pgp_sym_decrypt(location::bytea, '${this.key}')`, 'location')
      .addSelect(`pgp_sym_decrypt(email::bytea, '${this.key}')`, 'email')
      .addSelect(
        `pgp_sym_decrypt(phone_number::bytea, '${this.key}')`,
        'phoneNumber'
      )
      .where('pc.id IN (:...pId)', { pId: id })
      .getRawMany()) as Partial<PublicComment>[];
  }

  async isCreateAuthorized(
    dto: PublicCommentCreateRequest,
    user?: User
  ): Promise<boolean> {
    return this.projectAuthService.isAnonymousUserAllowedStateAccess(
      dto.projectId,
      [WorkflowStateEnum.COMMENT_OPEN],
      user
    );
  }

  async isUpdateAuthorized(
    dto: PublicCommentAdminUpdateRequest,
    entity: PublicComment,
    user?: User
  ): Promise<boolean> {
    return this.projectAuthService.isForestClientUserAllowedStateAccess(
      entity.projectId,
      [WorkflowStateEnum.COMMENT_OPEN, WorkflowStateEnum.COMMENT_CLOSED],
      user
    );
  }

  async isDeleteAuthorized(
    entity: PublicComment,
    user?: User
  ): Promise<boolean> {
    return false; // Comments cannot be deleted.
  }

  async isViewAuthorized(entity: PublicComment, user?: User): Promise<boolean> {
    if (!user) {
      return false; // Public not allowed to view comments.
    }
    if (user.isMinistry) {
      return true;
    }

    // Forest client users can access irregardless of the workflow state.
    return this.projectAuthService.isForestClientUserAccess(
      entity.projectId,
      user
    );
  }

  async findByProjectId(
    projectId: number,
    user: User
  ): Promise<PublicCommentAdminResponse[]> {
    if (!user.isMinistry) {
      // Don't check workflow states for viewing the comments.
      if (
        !(await this.projectAuthService.isForestClientUserAccess(
          projectId,
          user
        ))
      ) {
        throw new ForbiddenException();
      }
    }

    const options = this.addCommonRelationsToFindOptions({
      where: { projectId: projectId },
      order: { id: 'DESC' },
    });

    const records = await this.repository.find(options);

    if (!records || records.length == 0) {
      return [];
    }

    const recordIds = _.map(records, 'id');
    const decryptedColumnCollection = await this.obtainDecryptedColumns(
      recordIds
    );
    return records.map((r) => {
      const decryptedPartial = _.find(decryptedColumnCollection, { id: r.id });
      Object.assign(r, decryptedPartial);
      return this.convertEntity(r);
    });
  }

  /**
   * Returns the total number of public comments grouped by district.
   * Used by analytics dashboard module.
   *
   * @param startDate - Start of date range (YYYY-MM-DD)
   * @param endDate - End of date range (YYYY-MM-DD)
   * @returns Promise resolving to an array of PublicCommentCountByDistrictResponse
   */
  async getCommentCountByDistrict(
    startDate: string,
    endDate: string
  ): Promise<PublicCommentCountByDistrictResponse[]> {
    const qb = this.repository.createQueryBuilder('c');
    applyCommentCreateDateFilter(qb, startDate, endDate, 'c');
    return await qb
      .innerJoin('c.project', 'p')
      .innerJoin('p.district', 'd')
      .select('p.district_id', 'districtId')
      .addSelect('d.name', 'districtName')
      .addSelect('COUNT(c.public_comment_id)', 'publicCommentCount')
      .groupBy('p.district_id')
      .addGroupBy('d.name')
      .orderBy('"publicCommentCount"', 'DESC')
      .getRawMany();
  }

  /**
   * Retrieves the total number of public comments grouped by response code (category).
   * Used by analytics dashboard module.
   *
   * @param startDate - The start of the date range (inclusive, YYYY-MM-DD)
   * @param endDate - The end of the date range (inclusive, YYYY-MM-DD)
   * @returns Promise resolving to an array of PublicCommentCountByCategoryResponse
   */
  async getCommentCountByResponseCode(
    startDate: string,
    endDate: string
  ): Promise<PublicCommentCountByCategoryResponse[]> {
    const qb = this.repository.createQueryBuilder('c');
    applyCommentCreateDateFilter(qb, startDate, endDate, 'c');
    return await qb
      .select('response_code', 'responseCode')
      .addSelect('COUNT(public_comment_id)', 'publicCommentCount')
      .groupBy('response_code')
      .orderBy('"publicCommentCount"', 'DESC')
      .getRawMany();
  }

  /**
   * Retrieves total number of public comments grouped by project.
   * Return the top N most commented projects (FOMs).
   * Used by the analytics dashboard module.
   *
   * @param startDate - The start of the date range (inclusive, YYYY-MM-DD)
   * @param endDate - The end of the date range (inclusive, YYYY-MM-DD)
   * @param limit - The maximum number of projects to return
   * @returns Promise resolving to an array of PublicCommentCountByProjectResponse
   */
  async getCommentCountByProject(
    startDate: string,
    endDate: string,
    limit: number
  ): Promise<PublicCommentCountByProjectResponse[]> {
    const qb = this.repository.createQueryBuilder('c');
    applyCommentCreateDateFilter(qb, startDate, endDate, 'c');
    return qb
      .innerJoin('c.project', 'p')
      .select('p.project_id', 'projectId')
      .addSelect('p.name', 'projectName')
      .addSelect('COUNT(c.public_comment_id)', 'publicCommentCount')
      .groupBy('p.project_id')
      .addGroupBy('p.name')
      .orderBy('"publicCommentCount"', 'DESC')
      .limit(limit)
      .getRawMany();
  }
}
