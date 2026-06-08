import { Controller, Get, Post, Delete, Param, HttpStatus, Query, UseInterceptors, UploadedFile, Req, Request, Res, ParseIntPipe, BadRequestException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOkResponse, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Express } from 'express';
import { Multer } from 'multer'; // This is needed, don't know why Visual Studio Code thinks it isn't.

import { AttachmentService } from './attachment.service';
import { AttachmentCreateRequest, AttachmentResponse } from './attachment.dto';
import { User } from "@utility/security/user";
import { FileInterceptor } from '@nestjs/platform-express';
import { AttachmentTypeEnum } from './attachment-type-code.entity';
import { AuthGuard, AuthGuardMeta, GUARD_OPTIONS, UserHeader } from '@api-core/security/auth.guard';


// From https://github.com/nestjs/swagger/issues/417#issuecomment-562869578 and https://swagger.io/docs/specification/describing-request-body/file-upload/
const AttachmentPostBody = (fileName: string = 'file'): MethodDecorator => (
  target: any,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
) => {
  ApiBody({
    schema: {
      type: 'object',
      properties: {
        [fileName]: {
          type: 'string',
          format: 'binary',
        },
        projectId: {
          type: 'number'
        },
        attachmentTypeCode: {
          type: 'string'
        }
      },
    },
  })(target, propertyKey, descriptor);
};

export const maxFileSizeBytes = 31457280; // 30 MB amx attachment size

@ApiTags('attachment')
@UseGuards(AuthGuard)
@Controller('attachment')
export class AttachmentController {
  
  constructor(private readonly service: AttachmentService) {
  }

  // Need to use syntax that deviates considerably from other controllers in order to get post working with multipart/form-data that includes both a file and additional properties.
  // The normal @Body annotation didn't work in combination because the payload is form data, not a JSON document.
  @Post()
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: maxFileSizeBytes, files: 1} }))  // On failure returns HTTP 413 - payload too large.
  @ApiConsumes('multipart/form-data')
  @AttachmentPostBody() // This provides the OpenAPI documentation.
  async create(
    @UserHeader() user: User,
    @UploadedFile('file') file: Express.Multer.File,
    @Req() request: any
    ): Promise<AttachmentResponse> {

    const createRequest = new AttachmentCreateRequest();

    // 'Manually' extract form properties from the request and from the file.
    createRequest.projectId = await new ParseIntPipe().transform(request.body['projectId'], { type: 'body' });
    createRequest.attachmentTypeCode = request.body['attachmentTypeCode'];
    createRequest.fileName = file.originalname;
    createRequest.fileContents = file.buffer;

    const validAttachments:string[] = [AttachmentTypeEnum.PUBLIC_NOTICE, AttachmentTypeEnum.SUPPORTING_DOC, AttachmentTypeEnum.INTERACTION];
    if (validAttachments.indexOf(createRequest.attachmentTypeCode) < 0) {
      throw new BadRequestException("Validation failed (invalid attachment type)");
    }

    return this.service.create(createRequest, user);
  }

  @ApiProduces('application/octet-stream')
  @Get('/file/:id')
  @ApiBearerAuth()
  @AuthGuardMeta(GUARD_OPTIONS.ANONYMOUS_LIMITED)
  @ApiOkResponse({	schema: {
			type: 'string',
			format: 'binary',
		}}) 
  async getFileContents(
    @UserHeader() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Res() response: any) {

    const attachmentFileResponse = await this.service.getFileContent(id, user);
    response.attachment(attachmentFileResponse.fileName);
    response.send(attachmentFileResponse.fileContents);
  }

  // Accessible by public (if attachment type not interaction) and by authenticated users.
  @Get(':id')
  @ApiBearerAuth()
  @AuthGuardMeta(GUARD_OPTIONS.ANONYMOUS_LIMITED)
  @ApiResponse({ status: HttpStatus.OK, type: AttachmentResponse})
  async findOne(
    @UserHeader() user: User,
    @Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id, user);
  }

  @Get()
  @ApiBearerAuth()
  @AuthGuardMeta(GUARD_OPTIONS.ANONYMOUS_LIMITED)
  @ApiResponse({ status: HttpStatus.OK, type: [AttachmentResponse] }) 
  async find(
    @UserHeader() user: User,
    @Query('projectId', ParseIntPipe) projectId: number): Promise<AttachmentResponse[]> {
      return this.service.findByProjectIdNoInteraction(projectId, user);
  }


  @Delete(':id')
  @ApiBearerAuth()
  async remove(
    @UserHeader() user: User,
    @Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id, user);
  }

}
