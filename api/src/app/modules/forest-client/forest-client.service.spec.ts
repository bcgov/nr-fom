import { ClientAppIntegrationResponse } from '@api-core/client-app-integration/client-app-integration.dto';
import { ClientAppIntegrationService } from '@api-core/client-app-integration/client-app-integration.service';
import { ForestClient } from '@api-modules/forest-client/forest-client.entity';
import { ForestClientService } from '@api-modules/forest-client/forest-client.service';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppConfigService } from '@src/app/modules/app-config/app-config.provider';
import { PinoLogger } from 'nestjs-pino';
import { DataSource, FindOneOptions, Repository } from 'typeorm';

describe('ForestClientService', () => {
  let service: ForestClientService;
  let clientAppIntegrationService: ClientAppIntegrationService;
  let repository: Repository<ForestClient>;
  let configService: AppConfigService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: provideDependencyMock()
    }).compile();

    service = module.get<ForestClientService>(ForestClientService);
    clientAppIntegrationService = module.get<ClientAppIntegrationService>(ClientAppIntegrationService);
    repository = module.get(getRepositoryToken(ForestClient));
    configService = module.get<AppConfigService>(AppConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('batchClientDataRefresh', () => {
    let repositoryFindOneSpy;
    let repositoryUpsertSpy;
    let fetchClientNonIndividualsSpy;
    let configServiceGetPageSizeSpy;
    const PAGE_SIZE_DEFAULT = 1000;
    beforeEach(async () => {
      repositoryFindOneSpy = jest.spyOn(repository, 'findOne');
      repositoryUpsertSpy = jest.spyOn(repository, 'upsert');
      fetchClientNonIndividualsSpy = jest.spyOn(clientAppIntegrationService, 'fetchClientNonIndividuals');
      configServiceGetPageSizeSpy = jest.spyOn(configService, 'get');
    });

    it('Should end data refreshing when no data fetched from Client API.', async () => {
      fetchClientNonIndividualsSpy.mockResolvedValue([] as ClientAppIntegrationResponse[]);
      const called_with_first_page = 0;
      configServiceGetPageSizeSpy.mockReturnValue(PAGE_SIZE_DEFAULT)
      await service.batchClientDataRefresh();
      expect(fetchClientNonIndividualsSpy).toHaveBeenCalled();
      // Expect function fetched the first page.
      expect(fetchClientNonIndividualsSpy).toHaveBeenCalledWith(
        called_with_first_page, 
        PAGE_SIZE_DEFAULT,
        ClientAppIntegrationService.SORT_BY_CLIENT_NUMBER
      );
      // Expect function did not fetch the second page.
      expect(fetchClientNonIndividualsSpy).not.toHaveBeenCalledWith(
        called_with_first_page + 1, 
        PAGE_SIZE_DEFAULT,
        ClientAppIntegrationService.SORT_BY_CLIENT_NUMBER
      );
    });

    it('Should do data refresh when data returns and end data refreshing when subsequent call having no data fetched from Client API.', async () => {
      // Make fetching calls for max length times.
      const stopAtPage = sampleClientAppIntegrationResponseList.length; // Note, API starts at "page" 0.
      fetchClientNonIndividualsSpy.mockImplementation(
        (page, pageSize, sortedColumn) => mockFetchClientNonIndividualsStopAtPage(stopAtPage, page, pageSize, sortedColumn)
      );
      configServiceGetPageSizeSpy.mockReturnValue(PAGE_SIZE_DEFAULT)
      await service.batchClientDataRefresh();
      expect(fetchClientNonIndividualsSpy).toHaveBeenCalled();
      expect(fetchClientNonIndividualsSpy).toHaveBeenCalledTimes(stopAtPage + 1);
      expect(repositoryUpsertSpy).toHaveBeenCalled();
      expect(repositoryUpsertSpy).toHaveBeenCalledTimes(1*stopAtPage);
    });

  });

});

// Mock function to simulate calling API fetching data with page in sequence.
// Note API "page" param starts at 0;
// To simplify, returns only 1 item in list.
// Can only be called with stopAtPage <= sampleClientAppIntegrationResponseList.length
async function mockFetchClientNonIndividualsStopAtPage(
  stopAtPage: number, 
  page: number, 
  _pageSize, 
  _sortedColumn): Promise<ClientAppIntegrationResponse[]> 
{
  if (page >= 0 && page < stopAtPage && stopAtPage <= sampleClientAppIntegrationResponseList.length) {
    return [sampleClientAppIntegrationResponseList[page]];
  }
  return []; // empty list to indicates API return empty result for page.
}

class ForestClientRepositoryFake {
  public findOne(options: FindOneOptions<ForestClient>): Promise<ForestClient | null> {
    return null;
  }
  public upsert(): void {
    // This is intentional for empty body.
  }
}

function provideDependencyMock(): Array<any> {
  const dependencyMock = [
    ForestClientService,
    {
      provide: getRepositoryToken(ForestClient),
      useClass: ForestClientRepositoryFake
    },
    {
      provide: DataSource,
      useValue: {
          getRepository: jest.fn()
      }
    },
    {
      provide: ClientAppIntegrationService,
      useValue: {
        fetchClientNonIndividuals: jest.fn()
      }
    },
    {
      provide: AppConfigService,
      useValue: {
        get: jest.fn((x) => x)
      }
    },
    {
      provide: PinoLogger,
      useValue: {
        info: jest.fn((x) => x),
        setContext: jest.fn((x) => x),
      }
    }
  ]
  return dependencyMock;
}

const sampleClientAppIntegrationResponseList = [
  {
    id: '00000001',
    name: 'MANAGEMENT ABEYANCE',
    clientStatusCode: 'ACT',
    clientTypeCode: 'C'
  },
  {
    id: '00000002',
    name: 'PENDING S & R BILLING',
    clientStatusCode: 'DAC',
    clientTypeCode: 'G'
  },
  {
    id: '00000003',
    name: 'SECURITY & DAMAGE DEPOSITS',
    clientStatusCode: 'DAC',
    clientTypeCode: 'G'
  },
  {
    id: '00000004',
    name: 'EXPORT DEPOSITS',
    clientStatusCode: 'ACT',
    clientTypeCode: 'C'
  },
  {
    id: '00000005',
    name: 'CHRISTMAS TREE DEPOSITS',
    clientStatusCode: 'DAC',
    clientTypeCode: 'C'
  }
] as ClientAppIntegrationResponse[];

