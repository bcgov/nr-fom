import { BadRequestException, Controller, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PinoLogger } from 'nestjs-pino';
import { performance } from 'perf_hooks';

import { AuthGuard, AuthGuardMeta, GUARD_OPTIONS, UserHeader } from '@api-core/security/auth.guard';
import { User } from '@utility/security/user';
import { SpatialFeatureBcgwResponse, SpatialFeaturePublicResponse } from './spatial-feature.dto';
import { SpatialFeatureService } from './spatial-feature.service';

@ApiTags('spatial-feature')
@UseGuards(AuthGuard)
@Controller('spatial-feature')
export class SpatialFeatureController {
  constructor(
    private readonly spatialFeatureService: SpatialFeatureService,
    private readonly logger: PinoLogger) {
  }

  // Anonymous access allowed
  @Get() 
  @ApiBearerAuth()
  @AuthGuardMeta(GUARD_OPTIONS.ANONYMOUS_LIMITED)
  @ApiOkResponse({ type: [SpatialFeaturePublicResponse] })
  async getForProject(
    @UserHeader() user: User,
    @Query('projectId', ParseIntPipe) projectId: number): Promise<SpatialFeaturePublicResponse[]> {
    return this.spatialFeatureService.findByProjectId(projectId, user);
  }

  @Get('/bcgw-extract') 
  @AuthGuardMeta(GUARD_OPTIONS.PUBLIC)
  @ApiOkResponse({ type: [SpatialFeatureBcgwResponse] })
  async getBcgwExtract(
    @Query('version') version: string): Promise<any> {

    // Version acts as an informal API key (to prevent casual exploration of an expensive operation) plus provides a versioning capability.
    if (version != '1.0-final') {
      throw new BadRequestException('Invalid version');
    }

    this.logger.info('Start get /spatial-feature/bcgw-extract'); // For measuring performance.

    const start = performance.now();
    const result = await this.spatialFeatureService.getBcgwExtract();
    const end = performance.now();

    this.logger.info(`End get /spatial-feature/bcgw-extract for ${end - start}ms.`);

    return result;
  }

}
