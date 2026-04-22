import { DateTimeUtil } from '@api-core/dateTimeUtil';
import { ProjectService } from '@api-modules/project/project.service';
import { DataService } from '@core';
import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from "@utility/security/user";
import { PinoLogger } from 'nestjs-pino';
import { Repository } from 'typeorm';
import { AttachmentTypeEnum } from '../attachment/attachment-type-code.entity';
import { AttachmentCreateRequest } from '../attachment/attachment.dto';
import { AttachmentService } from '../attachment/attachment.service';
import { ProjectAuthService } from '../project/project-auth.service';
import { WorkflowStateEnum } from '../project/workflow-state-code.entity';
import { InteractionCreateRequest, InteractionResponse, InteractionUpdateRequest } from './interaction.dto';
import { Interaction } from './interaction.entity';
import _ from 'lodash';

@Injectable()
export class InteractionService extends DataService<Interaction, Repository<Interaction>, InteractionResponse> {
  constructor(
    @InjectRepository(Interaction)
    _repository: Repository<Interaction>,
    _logger: PinoLogger,
    private _projectAuthService: ProjectAuthService,
    private _attachmentService: AttachmentService,
    private _projectService: ProjectService
  ) {
    super(_repository, new Interaction(), _logger);
  }

  async create(request: InteractionCreateRequest, user: User): Promise<InteractionResponse> {

    await this.businessValidate(request);

    const {file, fileName} = request;
    // save attachment first.
    if (!_.isNil(fileName) && !_.isEmpty(fileName)) {
      request.attachmentId = await this.addNewAttachment(request.projectId, fileName, file, user);
    }

    const response = await super.create(request, user) as InteractionResponse;
    return response;
  }

  async update(id: number, updateRequest: InteractionUpdateRequest, user: User): Promise<InteractionResponse> {

    await this.businessValidate(updateRequest);

    const {file, fileName} = updateRequest;

    // Attachment update
    if (!_.isNil(fileName) && !_.isEmpty(fileName)) {
      const entity = await super.findEntityForUpdate(id);
      if (entity == undefined) {
        throw new BadRequestException("Entity does not exist.");
      }
      const prviousAttachmentId = entity.attachmentId;
      if (prviousAttachmentId) {
        const updateCount = (await super.updateEntity(id, {attachmentId: null}, entity)).affected; // remove previous attachment from Interaction first.
        if (updateCount != 1) {
          throw new InternalServerErrorException("Error removing previous attachment");
        }
    
        await this._attachmentService.delete(prviousAttachmentId, user);
      }
      updateRequest.attachmentId = await this.addNewAttachment(updateRequest.projectId, fileName, file, user);
    }

    // update interaction.
    updateRequest = _.omit(updateRequest, ['fileName', 'file']) as InteractionUpdateRequest;
    return super.update(id, updateRequest, user);
  }

  async delete(id: number, user?: User): Promise<void> {
    const entity = await super.findEntityForUpdate(id);
    if (entity == undefined) {
      return;
    }
    const attachmentId = entity.attachmentId;

    await super.delete(id, user);
    if (attachmentId) {
      await this._attachmentService.delete(attachmentId, user);
    }
  }

  private async addNewAttachment(projectId: number, fileName: string, file: Buffer, user: User): Promise<number> {
    const attachmentCreateRequest = new AttachmentCreateRequest();
    attachmentCreateRequest.projectId = projectId;
    attachmentCreateRequest.fileName = fileName;
    attachmentCreateRequest.fileContents = file;
    attachmentCreateRequest.attachmentTypeCode = AttachmentTypeEnum.INTERACTION;
    const attachmentId = (await this._attachmentService.create(attachmentCreateRequest, user)).id;
    return attachmentId;
  }

  // basic fields validation is done using 'class-validator' on request dto, this is further business validation.
  private async businessValidate(request: InteractionCreateRequest | InteractionUpdateRequest) {
    // communication_date: >= commenting_open_date
    const project = await this._projectService.findOne(request.projectId);
    const commentingOpenDate = project.commentingOpenDate;
    const communicationDate = request.communicationDate;

    if (DateTimeUtil.getBcDate(commentingOpenDate).startOf('day')
        .isAfter(DateTimeUtil.getBcDate(communicationDate).startOf('day'))) {
      throw new BadRequestException("Engagement Date should be on or after commenting start date.");
    }
  }

  async findByProjectId(projectId: number, user: User): Promise<InteractionResponse[]> {
    if (!user.isMinistry) {
      if (! await this._projectAuthService.isForestClientUserAccess(projectId, user)) {
        throw new ForbiddenException();
      }
    }
    
    const options = this.addCommonRelationsToFindOptions({
      where: { projectId: projectId }, 
      order: {id: 'DESC'}});

    const records = await this.repository.find(options);

    if (!records || records.length == 0) {
      return [];
    }

    const interactionResponses = records.map((r) => {
      const interactionResponse = this.convertEntity(r);
      return interactionResponse;
    });

    // include attachment meta info(if any)
    for (const interaction of interactionResponses) {
      if (interaction.attachmentId) {
        const attachment = await this._attachmentService.findOne(interaction.attachmentId, user);
        interaction.fileName = attachment.fileName;
      }
    }
    return interactionResponses;
  }
  
  async isCreateAuthorized(dto: InteractionCreateRequest, user?: User): Promise<boolean> {
    return this._projectAuthService.isForestClientUserAllowedStateAccess(dto.projectId, 
      [WorkflowStateEnum.COMMENT_OPEN, WorkflowStateEnum.COMMENT_CLOSED], user);
  }
  
  async isUpdateAuthorized(dto: InteractionCreateRequest, entity: Interaction, user?: User): Promise<boolean> {
    return this._projectAuthService.isForestClientUserAllowedStateAccess(dto.projectId, 
      [WorkflowStateEnum.COMMENT_OPEN, WorkflowStateEnum.COMMENT_CLOSED], user);
  }

  async isDeleteAuthorized(entity: Interaction, user?: User): Promise<boolean> {
    return this._projectAuthService.isForestClientUserAllowedStateAccess(entity.projectId, 
      [WorkflowStateEnum.COMMENT_OPEN, WorkflowStateEnum.COMMENT_CLOSED], user);
  }

  async isViewAuthorized(entity: Interaction, user?: User): Promise<boolean> {
    if (!user) {
      return false;
    }

    if (user.isMinistry) {
      return true;
    }

    // We ignore workflow state for viewing.
    return this._projectAuthService.isForestClientUserAccess(entity.projectId, user);
  }

  protected convertEntity(entity: Interaction): InteractionResponse {
    const response = new InteractionResponse();
    response.projectId = entity.projectId;
    response.stakeholder = entity.stakeholder;
    response.communicationDate = entity.communicationDate;
    response.communicationDetails = entity.communicationDetails;
    response.attachmentId = entity.attachmentId;
    response.createTimestamp = entity.createTimestamp.toISOString();
    response.revisionCount = entity.revisionCount;
    response.id = entity.id;
    return response;
  }

}
