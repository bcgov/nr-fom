import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiResponse } from '@nestjs/swagger';

import { CodeTableController } from '@controllers';
import { ResponseCodeService } from './response-code.service';
import { ResponseCode } from './response-code.entity';

@ApiTags('public-comment')
@Controller('response-code')
export class ResponseCodeController extends CodeTableController<ResponseCode> {
  constructor(protected readonly service: ResponseCodeService) {
    super(service);
  }

  @Get()
  @ApiResponse({ status: HttpStatus.OK, type: [ResponseCode] })
  async findAll(): Promise<ResponseCode[]> {
    return super.findAll();
  }

}
