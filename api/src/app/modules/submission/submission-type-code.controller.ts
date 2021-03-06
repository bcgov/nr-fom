import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiResponse } from '@nestjs/swagger';

import { CodeTableController } from '@controllers';
import { SubmissionTypeCodeService } from './submission-type-code.service';
import { SubmissionTypeCode } from './submission-type-code.entity';

@ApiTags('submission')
@Controller('submission-type-code')
export class SubmissionTypeCodeController extends CodeTableController<SubmissionTypeCode> {
  constructor(protected readonly service: SubmissionTypeCodeService) {
    super(service);
  }

  @Get()
  @ApiResponse({ status: HttpStatus.OK, type: [SubmissionTypeCode] })
  async findAll(): Promise<SubmissionTypeCode[]> {
    return super.findAll();
  }

}
