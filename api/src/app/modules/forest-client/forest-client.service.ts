import { DateTimeUtil } from '@api-core/dateTimeUtil';
import { DataService, mapToEntity } from '@core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PinoLogger } from 'nestjs-pino';
import { Repository } from 'typeorm';
import { ForestClientResponse } from './forest-client.dto';
import { ForestClient } from './forest-client.entity';
import { AppConfigService } from '@api-modules/app-config/app-config.provider';
import { ClientAppIntegrationService } from '@api-core/client-app-integration/client-app-integration.service';
import { ClientAppIntegrationResponse } from '@api-core/client-app-integration/client-app-integration.dto';
import { USER_SYSTEM } from '@src/app-constants';


@Injectable()
export class ForestClientService extends DataService<ForestClient, Repository<ForestClient>, ForestClientResponse> {

  constructor(
    @InjectRepository(ForestClient)
    repository: Repository<ForestClient>,
    logger: PinoLogger,
    private configService: AppConfigService,
    private clientAppIntegrationService: ClientAppIntegrationService
  ) {
    super(repository, new ForestClient(), logger);
  }

  // Return ForestClients matching the specified numbers. If no numbers are specified, nothing is returned.
  async find(forestClientNumbers: string[]): Promise<ForestClientResponse[]> {   
    this.logger.debug('Find criteria: %o', forestClientNumbers);

    if (!forestClientNumbers || forestClientNumbers.length == 0) {
      return Promise.resolve([]);
    }
    const query = this.repository.createQueryBuilder("fc")
      .addOrderBy('fc.name', 'ASC') // Newest first
      ;
    query.andWhere("fc.forest_client_number IN (:...forestClientNumbers)", { forestClientNumbers: forestClientNumbers});
  
    const result:ForestClient[] = await query.getMany();

    return result.map(forestClient => this.convertEntity(forestClient));
  }

  /**
   * Forest_Client data refreshing to app_fom.forest_client table.
   */
  async batchClientDataRefresh(): Promise<void> {
    this.logger.info(`Starting batch data refreshing on ${DateTimeUtil.nowBC()} for app_fom.forest_client records...`);
    let fetchedData: Array<ClientAppIntegrationResponse> = [];
    let currentPage = 0;
    let totalRecordsCount = 0;

    do {
      fetchedData = await this.clientAppIntegrationService.fetchClientNonIndividuals(
        currentPage, 
        this.configService.get("fcApiBatchSearchPageSize"),
        ClientAppIntegrationService.SORT_BY_CLIENT_NUMBER
      );
      fetchedData.forEach(async (item) => {
        let entity = await this.repository.findOne({ where: { id: item.id } })
        if (!entity) {
          entity = mapToEntity(item, new ForestClient());
          entity.createUser = USER_SYSTEM;
        }
        else {
          entity.revisionCount++;
          entity.updateUser = USER_SYSTEM;
          entity.updateTimestamp = new Date();
        }

        // Insert or Update to app_fom.forest_client table using TypeORM-"upsert".
        await this.repository.upsert(entity, ["id"]);
      });

      totalRecordsCount+=fetchedData.length;
      currentPage++;
    } while(fetchedData.length > 0)
    this.logger.info(`Completed batch data refreshing for total counts: ${totalRecordsCount}, on ${DateTimeUtil.nowBC()}`);
  }

  convertEntity(entity: ForestClient):ForestClientResponse {
    const dto = new ForestClientResponse();
    // Read-only so don't bother returning audit columns
    dto.id = entity.id;
    dto.name = entity.name;
    return dto;
  }

}
