import { DataService } from '@core';
import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Multer as _Multer } from 'multer'; // This is needed, don't know why Visual Studio Code thinks it isn't.
import { User } from "@utility/security/user";
import { PinoLogger } from 'nestjs-pino';
import { Stream } from 'node:stream';
import { Repository } from 'typeorm';
import { minioClient } from '../../../minio';
import { ProjectAuthService } from '../project/project-auth.service';
import { WorkflowStateEnum } from '../project/workflow-state-code.entity';
import { AttachmentTypeEnum } from './attachment-type-code.entity';
import { AttachmentCreateRequest, AttachmentFileResponse, AttachmentResponse } from './attachment.dto';
import { Attachment } from './attachment.entity';

@Injectable()
export class AttachmentService extends DataService<Attachment, Repository<Attachment>, AttachmentResponse> {
  constructor(
    @InjectRepository(Attachment)
    repository: Repository<Attachment>,
    logger: PinoLogger,
    private projectAuthService: ProjectAuthService
  ) {
    super(repository, new Attachment(), logger);
  }

  async create(request: AttachmentCreateRequest, user: User): Promise<AttachmentResponse> {

    const allowedExtensionsForPublicNotice: string[] = ['jpg', 'jpeg', 'png', 'tif', 'pdf'];
    const allowedExtensionsForOthers: string[] = ['doc', 'docx', 'pdf', 'jpg', 'jpeg', 'xls', 'xlsx', 'csv', 'msg', 'png', 'txt', 'rtf', 'tif'];

    const attachmentTypeCode = request.attachmentTypeCode;
    let allowedExtensions: string[] = allowedExtensionsForOthers;
    if (attachmentTypeCode == AttachmentTypeEnum.PUBLIC_NOTICE) {
      allowedExtensions = allowedExtensionsForPublicNotice;
    }

    const fileExtension:string = request.fileName.split('.').pop();
    if (!allowedExtensions.includes(fileExtension.toLowerCase())) {
      throw new BadRequestException(`Attachment of ${fileExtension} extension not permitted for ${attachmentTypeCode} attachment.`);
    }

    // Only one public notice and one interaction can exist per project
    if (attachmentTypeCode == AttachmentTypeEnum.PUBLIC_NOTICE) {
       
      const founds: Attachment[] = await this.repository.find({where: { projectId: request.projectId, attachmentTypeCode: attachmentTypeCode } });
      if (founds.length > 0) {
        // Need to do a security check before we actually delete the existing public notice. In this case, create permission implies delete permission.
        if (!await this.isCreateAuthorized(request, user)) {
          throw new ForbiddenException();
        }
        await this.repository.delete(founds[0].id);
        const objectName = this.createObjectUrl(founds[0].projectId, founds[0].id, founds[0].fileName);
        await this.deleteObject(process.env.OBJECT_STORAGE_BUCKET, objectName);

        // Now that the public notice is deleted, we can proceed with the regular creation.
      }
    }

    // Starting changes for Object Store
    const created = super.create(request, user);
    const primaryKey = (await created).id;
    this.uploadFileObjectStorage(request, primaryKey);

    return created;
  }

  uploadFileObjectStorage(request: AttachmentCreateRequest, primaryKey: number){

    const objectName = this.createObjectUrl(request.projectId, primaryKey, request.fileName);

    minioClient.putObject(process.env.OBJECT_STORAGE_BUCKET, objectName, request.fileContents, function(error, _objInfo) {
      if(error) {
        throw new InternalServerErrorException(error, 
          `Minio Client encountered problem while uploading file to storage to ${process.env.OBJECT_STORAGE_BUCKET},
           location: ${objectName}`);
      }
    });
  }
  async isCreateAuthorized(dto: AttachmentCreateRequest, user?: User): Promise<boolean> {
    if (dto.attachmentTypeCode == AttachmentTypeEnum.INTERACTION) {
      return this.projectAuthService.isForestClientUserAllowedStateAccess(dto.projectId, 
        [WorkflowStateEnum.COMMENT_OPEN, WorkflowStateEnum.COMMENT_CLOSED], user);
    }
    else {
      return this.projectAuthService.isForestClientUserAllowedStateAccess(dto.projectId, 
        [WorkflowStateEnum.INITIAL, WorkflowStateEnum.COMMENT_OPEN, WorkflowStateEnum.COMMENT_CLOSED], user);
    }
  }
  
  async isUpdateAuthorized(_dto: any, _entity: Attachment, _user?: User):Promise<boolean> {
    return false; // Updates not allowed.
  }

  async isDeleteAuthorized(entity: Attachment, user?: User):Promise<boolean> {
    const attachmentTypeCode = entity.attachmentType?.code;
    // for Interaction.
    if (attachmentTypeCode == AttachmentTypeEnum.INTERACTION) {
      return this.projectAuthService.isForestClientUserAllowedStateAccess(entity.projectId, 
        [WorkflowStateEnum.COMMENT_OPEN, WorkflowStateEnum.COMMENT_CLOSED], user);
    }

    // for public notice; public notice can't be deleted but can be replaced after initial state.
    if (attachmentTypeCode == AttachmentTypeEnum.PUBLIC_NOTICE) {
      return this.projectAuthService.isForestClientUserAllowedStateAccess(entity.projectId, 
        [WorkflowStateEnum.INITIAL], user);
    }

    // for other types, like supporting doc
    return this.projectAuthService.isForestClientUserAllowedStateAccess(entity.projectId, 
      [WorkflowStateEnum.INITIAL, WorkflowStateEnum.COMMENT_OPEN, WorkflowStateEnum.COMMENT_CLOSED], user);
  }

  async isViewAuthorized(entity: Attachment, user?: User): Promise<boolean> {
    const attachmentTypeCode = entity.attachmentType?.code;
    if (attachmentTypeCode == AttachmentTypeEnum.PUBLIC_NOTICE || attachmentTypeCode == AttachmentTypeEnum.SUPPORTING_DOC) {
      // These document types are viewable by the public.
      return true;
    }

    if (user?.isMinistry) {
      return true;
    }

    // Forest client users can access irregardless of the workflow state.
    return this.projectAuthService.isForestClientUserAccess(entity.projectId, user);
  }

  protected getCommonRelations(): string[] {
    return ['attachmentType'];
  }

  protected convertEntity(entity: Attachment): AttachmentResponse { 
    const response = new AttachmentResponse();
    response.projectId = entity.projectId;
    response.attachmentType = entity.attachmentType;
    response.fileName = entity.fileName;
    response.id = entity.id;
    response.createTimestamp = entity.createTimestamp;

    return response;
  }

  async getFileContent(id: number, user?: User): Promise<AttachmentFileResponse> {
    const attachmentFileResponse = await this.findFileDatabase(id, user);

    //Creating the objectName for the Object Storage
    const objectName = this.createObjectUrl(attachmentFileResponse.projectId, attachmentFileResponse.id, attachmentFileResponse.fileName )

    //Reading the object from Object Storage
    const dataStream  = await this.getObjectStream(process.env.OBJECT_STORAGE_BUCKET, objectName );

    //Reading the content of the object from Object Storage
    const finalBuffer = await this.stream2buffer(dataStream);

    attachmentFileResponse.fileContents = finalBuffer;

    return attachmentFileResponse;

  }

  async findFileDatabase(id: number, user?: User): Promise<AttachmentFileResponse> {
    // Works, but fileContents being treated as a Buffer...

    const entity:Attachment = await this.findEntityWithCommonRelations(id);
    if (!entity) {
      throw new BadRequestException("No entity for the specified id.");
    }

    if (!await this.isViewAuthorized(entity, user)) {
      throw new ForbiddenException();
    }

    const attachmentResponse = this.convertEntity(entity);
    const attachmentFileResponse = { ...attachmentResponse} as AttachmentFileResponse;

    return attachmentFileResponse;
  }

  createObjectUrl(projectId: number, attachmentId: number, fileName: string): string {
    if(process.env.INSTANCE_URL_PREFIX && process.env.INSTANCE_URL_PREFIX.length > 0) {
        return process.env.INSTANCE_URL_PREFIX + '/' +
        projectId + '/' + attachmentId + '/' + fileName;
    }
    return projectId + '/' + attachmentId + '/' + fileName;
  }


  async getObjectStream(bucket: string, objectName: string): Promise<Stream>{

    return minioClient.getObject(bucket, objectName);
  }


  async deleteObject(bucket: string, objectName: string): Promise<boolean>{
    
    return new Promise((resolve, _reject) => {

      return minioClient.removeObject(bucket, objectName, function (err: any) {
        if (err) {
          console.error("Unable to remove object: ", err);
          return resolve(false);
        }
      return resolve(true);
      });
    });
  }

  async stream2buffer(stream: Stream): Promise<Buffer> {

    return new Promise < Buffer > ((resolve, reject) => {
        
        const _buf = Array < any > ();

        stream.on("data", chunk => _buf.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(_buf)));
        stream.on("error", err => reject(`error converting stream - ${err}`));

    });
  }
  
  async delete(attachmentId: number, user?: User): Promise<void> {
    const attachmentFileResponse = await this.findFileDatabase(attachmentId, user);
    const deleted = super.delete(attachmentId, user);

    await this.deleteAttachmentObject(attachmentFileResponse.projectId, attachmentFileResponse.id, attachmentFileResponse.fileName) ;

    return deleted;

  }

  async deleteAttachmentObject(projectId: number, attachmentId: number, fileName: string) {

      //Creating the objectName for the Object Storage
      const objectName = this.createObjectUrl(projectId, attachmentId, fileName )

      //Deleting the object
      await this.deleteObject(process.env.OBJECT_STORAGE_BUCKET, objectName);
  }

  /* This function only returns attachments of the following types:
  * - PUBLIC NOTICE
  * - SUPPORTING_DOC
  */
  async findByProjectIdNoInteraction(projectId: number, user?: User): Promise<AttachmentResponse[]> {

    if (user && !user.isMinistry) {
      // Don't check workflow states for viewing the comments.
      if (! await this.projectAuthService.isForestClientUserAccess(projectId, user)) {
        throw new ForbiddenException();
      }
    }
    
    const query = this.repository.createQueryBuilder("a")
      .leftJoinAndSelect("a.attachmentType", "attachmentType")
      .andWhere("a.project_id = :projectId", {projectId: `${projectId}`})
      .addOrderBy('a.attachment_id', 'DESC') // Newest first
      ;

      query.andWhere('a.attachment_type_code IN (:...attachmentTypeCodes)', { attachmentTypeCodes: [AttachmentTypeEnum.PUBLIC_NOTICE, AttachmentTypeEnum.SUPPORTING_DOC] });

    const records:Attachment[] = await query.getMany();
    return records.map(attachment => this.convertEntity(attachment));
  }

    /* This function returns all attachments types:
    * - PUBLIC NOTICE
    * - SUPPORTING_DOC
    * - INTERACTION
    * 
    * This is needed when deleting the FOM.
    */
    async findAllAttachments(projectId: number, user?: User): Promise<AttachmentResponse[]> {
  
      if (user && !user.isMinistry) {
        // Don't check workflow states for viewing the comments.
        if (! await this.projectAuthService.isForestClientUserAccess(projectId, user)) {
          throw new ForbiddenException();
        }
      }
      
      const query = this.repository.createQueryBuilder("a")
        .leftJoinAndSelect("a.attachmentType", "attachmentType")
        .andWhere("a.project_id = :projectId", {projectId: `${projectId}`})
        .addOrderBy('a.attachment_id', 'DESC') // Newest first
        ;

      const records:Attachment[] = await query.getMany();
      return records.map(attachment => this.convertEntity(attachment));
    }

  async findByProjectIdAndAttachmentTypes(projectId: number, attachmentTypeCodes: AttachmentTypeEnum[]): Promise<Attachment[]> {
    const query = this.repository.createQueryBuilder("a")
      .leftJoinAndSelect("a.attachmentType", "attachmentType")
      .andWhere("a.project_id = :projectId", {projectId: `${projectId}`})
      .andWhere('a.attachment_type_code IN (:...attachmentTypeCodes)', 
                { attachmentTypeCodes: attachmentTypeCodes})
      .addOrderBy('a.attachment_id', 'DESC');

    return query.getMany();
  }

}
