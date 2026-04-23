import { AuthGuard, UserHeader } from '@api-core/security/auth.guard';
import { BadRequestException, Controller, Delete, Get, HttpStatus, Param, ParseIntPipe, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from "@utility/security/user";
import { validate } from 'class-validator';
import dayjs from 'dayjs';
import 'dayjs/plugin/utc';
import 'dayjs/plugin/timezone';
import { maxFileSizeBytes } from '../attachment/attachment.controller';
import { InteractionCreateRequest, InteractionResponse, InteractionUpdateRequest } from './interaction.dto';
import { InteractionService } from './interaction.service';
import fetch from 'node-fetch';
import { PinoLogger } from 'nestjs-pino';

// From https://github.com/nestjs/swagger/issues/417#issuecomment-562869578 and https://swagger.io/docs/specification/describing-request-body/file-upload/
const AttachmentPostBody = (file: string = 'file'): MethodDecorator => (
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor,
) => {
  ApiBody({
    schema: {
      type: 'object',
      properties: {
        [file]: {
          type: 'string',
          format: 'binary',
        },
        projectId: {
          type: 'number'
        },
        stakeholder: {
          type: 'string'
        },
        communicationDate: {
          type: 'string'
        },
        communicationDetails: {
          type: 'string'
        },
        filename: {     // add extra 'filename' field for posted form's params
          type: 'string'
        }
      },
    },
  })(target, propertyKey, descriptor);
};

const AttachmentUpdateBody = (file: string = 'file'): MethodDecorator => (
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor,
) => {
  ApiBody({
    schema: {
      type: 'object',
      properties: {
        [file]: {
          type: 'string',
          format: 'binary',
        },
        projectId: {
          type: 'number'
        },
        stakeholder: {
          type: 'string'
        },
        communicationDate: {
          type: 'string'
        },
        communicationDetails: {
          type: 'string'
        },
        revisionCount: {
          type: 'number'
        },
        filename: {
          type: 'string'
        }
      },
    },
  })(target, propertyKey, descriptor);
};

@ApiTags('interaction')
@UseGuards(AuthGuard)
@Controller('interaction')
export class InteractionController {

  constructor(
    private readonly service: InteractionService,
    private logger: PinoLogger
  ) {}

  // note, for @UploadedFile('file') file field:
  // Using formData posted, we can obtain fileContent/filename directly from post body, as long as
  // you defined the fields(also filename field) for it and not necessarily needing to get from Multer.File.
  // Especially for using generated 'api-client' it can only be obrained from 'body' but from Swagger's
  // OpenAPI page, you get the file from using @UploadedFile field.
  @Post()
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: maxFileSizeBytes, files: 1} }))
  @ApiConsumes('multipart/form-data')
  @AttachmentPostBody() // This provides the OpenAPI documentation.
  @ApiResponse({ status: HttpStatus.CREATED })
  async create(
    @UserHeader() user: User,
    @UploadedFile('file') file: Express.Multer.File,
    @Req() request: Request): Promise<InteractionResponse> {
      const createRequest = new InteractionCreateRequest(
        await new ParseIntPipe().transform(request.body['projectId'], null),
        request.body['stakeholder'],
        request.body['communicationDate'],
        request.body['communicationDetails'],
        // Note, the generated api-client has little issue; it uses 'FormData' to append a file, but did not provide third
        // argument for 'filename'. To still use generated api-client, 'filename' could be found from extra formData property.
        file?.originalname?.includes(".")? file.originalname: request.body['filename'],
        file? file.buffer: request.body['file']['buffer'],
      );

      // Validate fields.
      const vErrors = await validate(createRequest, { forbidUnknownValues: true, validationError: { target: false } });
      if (vErrors && vErrors.length >=1) {
        const errMsgs = vErrors.map(oErr => Object.values(oErr.constraints)[0]);
        this.logger.debug('Create Interaction validation errors: %o', errMsgs);
        throw new BadRequestException(`Validation failed (${errMsgs})`);
      }
      return this.service.create(createRequest, user);
  }

  @Get()
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK, type: [InteractionResponse] })
  async find(
    @UserHeader() user: User,
    @Query('projectId', ParseIntPipe) projectId: number): Promise<InteractionResponse[]> {
      return this.service.findByProjectId(projectId, user);
  }

  @Put(':id')
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: maxFileSizeBytes, files: 1} }))
  @ApiConsumes('multipart/form-data')
  @AttachmentUpdateBody()
  @ApiResponse({ status: HttpStatus.OK, type: InteractionResponse })
  async update(
    @UserHeader() user: User,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile('file') file: Express.Multer.File,
    @Req() request: Request): Promise<InteractionResponse> {      
      const updateRequest = new InteractionUpdateRequest(
        await new ParseIntPipe().transform(request.body['projectId'], null),
        request.body['stakeholder'],
        request.body['communicationDate'],
        request.body['communicationDetails'],
        file?.originalname?.includes(".")? file.originalname: request.body['filename'],
        file? file.buffer: request.body['file']['buffer'],
        id,
        await new ParseIntPipe().transform(request.body['revisionCount'], null)
      );

      // Validate fields.
      const vErrors = await validate(updateRequest, { forbidUnknownValues: true, validationError: { target: false } });
      if (vErrors && vErrors.length >=1) {
        const errMsgs = vErrors.map(oErr => Object.values(oErr.constraints)[0]);
        this.logger.debug('Update Interaction validation errors: %o', errMsgs);
        throw new BadRequestException(`Validation failed (${errMsgs})`);
      }
      return this.service.update(id, updateRequest, user);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK })
  async remove(
    @UserHeader() user: User,
    @Param('id', ParseIntPipe) id: number) {
    await this.service.delete(id, user);
  }

}