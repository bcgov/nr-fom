import { ApiBaseEntity, DeepPartial } from '@entities';
import { BadRequestException, ForbiddenException, Inject, Injectable, InternalServerErrorException, UnprocessableEntityException } from '@nestjs/common';
import * as dayjs from 'dayjs';
import { PinoLogger } from 'nestjs-pino';
import { DataSource, FindOptionsWhere, Repository, UpdateResult } from 'typeorm';
import { FindManyOptions } from 'typeorm/find-options/FindManyOptions';
import { FindOneOptions } from 'typeorm/find-options/FindOneOptions';

import { mapToEntity } from '@core';
import { User } from "@utility/security/user";
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

/**
 * Base class to extend for interacting with the database through a repository pattern.
 * Provides standard CRUD services. 
 * Inputs are requestDTOs or find parameters/options. 
 * Conversions from request DTOs to entity are done automatically, copying all the fields from the source into the target. 
 * This assumes each request DTO attribute maps to the same entity attribute. If different behavior is desired convertDto() can be overridden.
 * 
 * Outputs are entities, although a convertEntity() hook can be overriden to change this.
 * A standard set of relations to be loaded (as find options) can be provided 
 * which will be used to ensure retrieved entities in different scenarios (e.g. from update, findOne, findMany) have a common set of children.
 * 
 * Data modification methods (create, update, delete) include handling of user authorization and metadata columns (create/update user/timestamp + revision count)
 * FindOne view method includes handling of user authorization. 
 * FindAll methods do not (because typically access depends on the where criteria, so security should be applied at the controller level.)
 * 
 * Default implementations of user authorization methods reject all users (which is the safest from a security standpoint) but will therefore need to be overridden.
 * 
 * If this class doesn't fit your use case it is perfectly acceptable to use a completely custom service. See e.g. SubmissionService. 
 * Although handling of security and metadata columns will then need to be done.
 *
 * @class DataService
 * @template E - entity extends ApiBaseEntity<E>
 * @template R - repository extends Repository<E>
 * @template O - output (response) object type, defaults to entity.
 */
@Injectable()
export abstract class DataService<
  E extends ApiBaseEntity<E>,
  R extends Repository<E>,
  O
> {

  @Inject(DataSource)
  private readonly dataSource: DataSource;

  protected constructor(
    protected repository: R,
    private entity: E, // prototype for creating a new entity instance
    protected readonly logger: PinoLogger
  ) {
    logger.setContext(this.constructor.name);
  }

  protected getDataSource() {
    return this.dataSource;
  }

  /**
   * 
   * @param user May be null if anonymous. 
   * @param dto 
   */
  async isCreateAuthorized(_dto: unknown, _user?: User): Promise<boolean> {
    return false;
  }
  
  async isUpdateAuthorized(_dto: unknown, _entity: E, _user?: User): Promise<boolean> {
    return false;
  }

  async isDeleteAuthorized(_entity: E, _user?: User): Promise<boolean> {
    return false;
  }

  async isViewAuthorized(_entity: E, _user?: User): Promise<boolean> {
    return false;
  }

  /**
   * Create a repository item
   *
   * @param {E} dto
   * @return {*}
   * @memberof DataService
   */
  async create(requestDto: any, user: User): Promise<O> {
    this.logger.debug(`${this.constructor.name}.create dto %o`, requestDto);

    if (! await this.isCreateAuthorized(requestDto, user)) {
      throw new ForbiddenException(`User ${user.userName} is not granted for 'create' action.`);
    }

    requestDto.createUser = user ? user.userName : 'Anonymous';

    const entityToCreate = this.entity.factory(await this.convertDto(requestDto));
    const savedEntity = await this.saveEntity(entityToCreate);

    return this.convertEntity(savedEntity);
  }

  protected async convertDto(dto: any, existingEntity?: Partial<E>): Promise<QueryDeepPartialEntity<E>> {
    const entity = existingEntity ? existingEntity : {} as E;
    return mapToEntity(dto, entity);
  }

  protected convertEntity(entity: E): O {
    return (entity as unknown) as O; // Conversion to unknown first to satisfy Typescript. This logic only works if O = E (or a subset).
  }

  // A hook on saving entity for other service to override if it needs extra operation, like db column encryption.
  protected async saveEntity(model: DeepPartial<E>): Promise<E> {
    // <any> necessary to work around type complaint, but the code functions.
    return this.repository.save(<any>model);
  }
  
  // A hook on updating entity for other service to override if it needs extra operation, like db column encryption.
  protected async updateEntity(id: string | number, dto: Partial<any>, entity: E): Promise<UpdateResult> {
    return this.repository.update(id, await this.convertDto(dto, entity));
  }

  // Deliberately exclude loading relations for updates. TypeORM gets confused if an entity has both the id field and the relation field populated on update.
  protected async findEntityForUpdate(id: string | number): Promise<E|undefined> {
    return this.repository.findOne({ where: { id } } as FindOneOptions);
  }

  // A hook on find entity for other service to override if it needs extra operation, like db column decryption.
  protected async findEntityWithCommonRelations(id: string | number, options?: FindOneOptions<E> | undefined): Promise<E|undefined> {
    const revisedOptions = this.addCommonRelationsToFindOptions(options);
    revisedOptions.where = {...revisedOptions.where, id } as unknown as FindOptionsWhere<E>;
    return this.repository.findOne(revisedOptions);
  }

  protected addCommonRelationsToFindOptions(options?: FindOneOptions<E>): FindOneOptions<E> {
    const revisedOptions = options ? options : {};
    revisedOptions.relations = options?.relations ? options.relations : {};
    // this.getCommonRelations() is an 'array', but options.relations is 'object'
    this.getCommonRelations().forEach(cRelation => {
      if (! (cRelation in revisedOptions.relations)) { 
        revisedOptions.relations[cRelation] = true;
      }
    });
    return revisedOptions;
  }

  protected getCommonRelations(): string[] {
    return [];
  }


  /**
   * Update a record by Id with deep partial
   *
   * @param {string} id
   * @param dto
   * @return {*}
   * @memberof DataService
   */
  async update(id: number | string, requestDto: any, user?: User): Promise<O> {
    requestDto.updateUser = user ? user.userName : 'Anonymous';
    // Saving update timestamp in UTC format is fine.
    requestDto.updateTimestamp = dayjs().format();

    this.logger.debug(`${this.constructor.name}.update dto %o`, requestDto);

    const entity:E = await this.findEntityForUpdate(id)
    if (! entity) {
      throw new BadRequestException("Entity not found.");
    }
    if (! await this.isUpdateAuthorized(requestDto, entity, user)) {
      throw new ForbiddenException();
    }
    if (entity.revisionCount != requestDto.revisionCount) {
      this.logger.debug("Entity revision count " + entity.revisionCount + " dto revision count = " + requestDto.revisionCount);
      throw new UnprocessableEntityException("The record you are trying to save has been changed since you retrieved it for editing. Please refresh and try again.");
    }
    requestDto.revisionCount += 1;

    const updateCount = (await this.updateEntity(id, requestDto, entity)).affected;
    if (updateCount != 1) {
      throw new InternalServerErrorException("Error updating object");
    }

    const updatedEntity = await this.findEntityWithCommonRelations(id);
    this.logger.debug(`${this.constructor.name}.update result entity %o`, updatedEntity);

    return this.convertEntity(updatedEntity);
  }

  /**
   * Delete record by Id
   *
   * @param {string} id
   * @return {*}
   * @memberof DataService
   */
  async delete(id: number | string, user?: User): Promise<void> {
    this.logger.debug(`${this.constructor.name}.delete id %o`, id);

    const entity:(E|undefined) = await this.repository.findOne({ where: { id } } as FindOneOptions);
    if (entity == undefined) {
      throw new BadRequestException("Entity does not exist.");
    }
    if (! await this.isDeleteAuthorized(entity, user)) {
      throw new ForbiddenException();
    }

    const deleteCount = (await this.repository.delete(id)).affected;
    if (deleteCount != 1) {
      throw new BadRequestException("No entity to delete");
    }
  }

  /**
   * Find a record by Id
   *
   * @param {string} id
   * @param {FindOneOptions} options
   * @return {*}
   * @memberof DataService
   */
   async findOne(
    id: number | string, user?: User, 
    options?: FindOneOptions<E> | undefined
  ): Promise<O> {
    this.logger.debug(`${this.constructor.name}findOne id %o`, id);

    const entity:(E|undefined) = await this.findEntityWithCommonRelations(id, options);
    if (entity == undefined) {
      throw new BadRequestException("No entity for the specified id.");
    }

    if (! await this.isViewAuthorized(entity, user)) {
      throw new ForbiddenException();
    }
  
    return this.convertEntity(entity);
  }

  /**
   * Find all records in collection. No authorization check is performed.
   *
   * @return {*}
   * @memberof DataService
   */
  async findAllUnsecured(options?: FindManyOptions<E> | undefined): Promise<O[]> {
    this.logger.debug(`${this.constructor.name}.findAll options %o ` + options);

    const findAll = await this.repository.find(this.addCommonRelationsToFindOptions(options));
    return findAll.map((r) => this.convertEntity(r));
  }

}
