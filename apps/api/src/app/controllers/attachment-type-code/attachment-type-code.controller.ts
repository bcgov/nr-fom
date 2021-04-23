import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiResponse } from '@nestjs/swagger';

import { CodeTableController } from '@controllers';
import { AttachmentTypeCodeService } from './attachment-type-code.service';
import { AttachmentTypeCode } from './entities/attachment-type-code.entity';
import { AttachmentTypeCodeDto } from './dto/attachment-type-code.dto';
import { UpdateAttachmentTypeCodeDto } from './dto/update-attachment-type-code.dto';

@ApiTags('attachment-type-code')
@Controller('attachment-type-code')
export class AttachmentTypeCodeController extends CodeTableController<
  AttachmentTypeCode,
  AttachmentTypeCodeDto,
  UpdateAttachmentTypeCodeDto
> {
  constructor(protected readonly service: AttachmentTypeCodeService) {
    super(service);
  }

  @Get()
  @ApiResponse({ status: 200, type: [AttachmentTypeCodeDto] })
  async findAll(): Promise<AttachmentTypeCodeDto[]> {
    return super.findAll();
  }

  @Get(':id')
  @ApiResponse({ status: 200, type: AttachmentTypeCodeDto })
  async findOne(@Param('id') id: string): Promise<AttachmentTypeCodeDto> {
    return super.findOne(id);
  }
}
