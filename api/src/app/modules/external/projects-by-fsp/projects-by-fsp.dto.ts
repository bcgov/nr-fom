import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ForestClientResponse } from "@src/app/modules/forest-client/forest-client.dto";

export class ProjectByFspResponse {

    @ApiProperty()
    fomId!: number;
  
    @ApiProperty()
    name!: string;
  
    @ApiProperty()
    fspId!: number;
  
    @ApiPropertyOptional()
    forestClient!: ForestClientResponse;
  }
