import { Body, Controller, Delete, Get, HttpStatus, Param, ParseIntPipe, Post, Put, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PinoLogger } from 'nestjs-pino';

import { User } from "@utility/security/user";
import { PublicNoticeCreateRequest, PublicNoticePublicFrontEndResponse, PublicNoticeResponse, PublicNoticeUpdateRequest } from './public-notice.dto';
import { PublicNoticeService } from './public-notice.service';
import { AuthGuard, AuthGuardMeta, GUARD_OPTIONS, UserHeader } from '@api-core/security/auth.guard';


@ApiTags('public-notice')
@UseGuards(AuthGuard)
@Controller('public-notice')
export class PublicNoticeController {
  constructor(
    private readonly service: PublicNoticeService,
    private readonly logger: PinoLogger) {
  }

  @Get()
  @AuthGuardMeta(GUARD_OPTIONS.PUBLIC)
  @ApiResponse({ status: HttpStatus.OK, type: [PublicNoticePublicFrontEndResponse] })
  async findListForPublicFrontEnd(
    ): Promise<PublicNoticePublicFrontEndResponse[]> {

      return this.service.findForPublicFrontEnd();
  }

  // Find the last updated public notice for the same Forest Client.
  @Get('/latest/:forestClientId')
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK, type: PublicNoticeResponse })
  async findLatestPublicNotice(
    @UserHeader() user: User,
    @Param('forestClientId') forestClientId: string  
    ): Promise<PublicNoticeResponse> {
      const result = await this.service.findLatestPublicNotice(forestClientId, user);
      if (!result) {
        throw new NotFoundException(`Latest public notice not found for forest client ${forestClientId}`);
      }
      return result;
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK, type: PublicNoticeResponse })
  async findOne(
    @UserHeader() user: User,
    @Param('id', ParseIntPipe) id: number): Promise<PublicNoticeResponse> {
    return this.service.findOne(id, user);
  }
  
  @Post()
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.CREATED, type: PublicNoticeResponse })
  async create(
    @UserHeader() user: User,
    @Body() request: PublicNoticeCreateRequest
    ): Promise<PublicNoticeResponse> {
    return this.service.create(request, user);
  }

  @Put(':id')
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK, type: PublicNoticeResponse })
  @ApiBody({ type: PublicNoticeUpdateRequest })
  async update(
    @UserHeader() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() request: PublicNoticeUpdateRequest
  ): Promise<PublicNoticeResponse> {
    return this.service.update(id, request, user);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK })
  async remove(
    @UserHeader() user: User,
    @Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id, user);
  }

}
