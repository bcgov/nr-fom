import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiResponse } from '@nestjs/swagger';

import { CodeTableController } from '@controllers';
import { CommentScopeCodeService } from './comment-scope-code.service';
import { CommentScopeCode } from './comment-scope-code.entity';

@ApiTags('public-comment')
@Controller('comment-scope-code')
export class CommentScopeCodeController extends CodeTableController<CommentScopeCode> {
  constructor(protected readonly service: CommentScopeCodeService) {
    super(service);
  }

  @Get()
  @ApiResponse({ status: HttpStatus.OK, type: [CommentScopeCode] })
  async findAll(): Promise<CommentScopeCode[]> {
    return super.findAll();
  }

}
