import { ArgumentMetadata, BadRequestException, Controller, Get, HttpStatus, Injectable, PipeTransform, Query } from '@nestjs/common';
import { ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProjectByFspResponse as ProjectsByFspResponse } from '@src/app/modules/external/projects-by-fsp/projects-by-fsp.dto';
import { ProjectsByFspService } from '@src/app/modules/external/projects-by-fsp/projects-by-fsp.service';
import { PinoLogger } from 'nestjs-pino';

// Custom pipe transformer for controller parameter conversion.
@Injectable()
export class PositiveIntPipe implements PipeTransform<number, number> {
    transform(value: any, metadata: ArgumentMetadata) {

        if(/^\d+$/.test(value)) {
            const intValue = parseInt(value, 10);
            if ( intValue > 0 && intValue <= 2147483647) {
                return value;
            }
        }

        throw new BadRequestException('Value must be a positive integer not exceeding 2147483647.');
    }
}

@ApiTags("external")
@Controller("external")
export class ProjectsByFspController {
  constructor(
    private readonly service: ProjectsByFspService,
    private readonly _logger: PinoLogger) {
  }

  @Get("fom-by-fsp")
  @ApiQuery({ name: 'fspId', required: true})
  @ApiResponse({ status: HttpStatus.OK, type: [ProjectsByFspResponse] })
  async findByFsp(
    @Query('fspId', PositiveIntPipe) fspId: number
  ): Promise<ProjectsByFspResponse[]> {
    return this.service.findByFspId(fspId);
  }
}