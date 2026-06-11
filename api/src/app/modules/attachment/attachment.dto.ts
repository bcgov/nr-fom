import { ApiProperty } from '@nestjs/swagger';

import { AttachmentTypeCode } from './attachment-type-code.entity';

// See AttachmentController.create for why these are not annotated with @ApiProperty.
export class AttachmentCreateRequest {
  projectId!: number;

  fileName!: string; 

  fileContents!: Buffer; 

  attachmentTypeCode!: string;
}

export class AttachmentResponse {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  projectId!: number;

  @ApiProperty()
  fileName!: string;

  @ApiProperty()
  attachmentType!: AttachmentTypeCode;
  
  @ApiProperty()
  createTimestamp!: Date;

  // Don't need revisionCount because updates are not allowed.
}

export class AttachmentFileResponse extends AttachmentResponse {

  @ApiProperty()
  fileContents!: Buffer;

}
