import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { ClientAppIntegrationResponse } from '@src/core/client-app-integration/client-app-integration.dto';
import { AxiosError, AxiosResponse, AxiosHeaders } from 'axios';
import { PinoLogger } from 'nestjs-pino';
import { of } from 'rxjs';
import { ClientAppIntegrationService } from './client-app-integration.service';

describe('ClientAppIntegrationService', () => {
  const CLIENT_FETCH_ALL_API_PATH = "/findAllNonIndividuals";
  let service: ClientAppIntegrationService;
  let httpService: HttpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: provideDependencyMock()
    }).compile();

    service = module.get<ClientAppIntegrationService>(ClientAppIntegrationService);
    httpService = module.get<HttpService>(HttpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetchClientNonIndividuals', () => {
    // page starts from '0' as first page.
    const sampleParams = {"page": 0, "size": 1000, "sortedColumnName": "clientNumber"};
    let httpGetSpy: any;
    beforeEach(async () => {
        httpGetSpy = jest.spyOn(httpService, 'get');
    });

    it('Should call http service with mapped return.', async () => {
      httpGetSpy.mockReturnValue(of<AxiosResponse>(sampleAxiosResponse));

      const expectMappedResult = getExpectMappedResult(sampleAxiosResponse);
      const result = await service.fetchClientNonIndividuals(sampleParams.page, sampleParams.size, sampleParams.sortedColumnName);
      expect(httpGetSpy).toHaveBeenCalled();
      expect(httpGetSpy).toHaveBeenCalledWith(expect.stringContaining(CLIENT_FETCH_ALL_API_PATH), { params: sampleParams });
      expect(expectMappedResult).toMatchObject<ClientAppIntegrationResponse[]>(result);
      expect(expectMappedResult[0].id).toBe(sampleAxiosResponse.data[0].clientNumber);
      expect(expectMappedResult[0].name).toBe(sampleAxiosResponse.data[0].clientName);
      expect(expectMappedResult[1].id).toBe(sampleAxiosResponse.data[1].clientNumber);
      expect(expectMappedResult[1].name).toBe(sampleAxiosResponse.data[1].clientName);
    })

    it('Should return empty when CLIENT api returns empty data.', async () => {
        httpGetSpy.mockReturnValue(of<AxiosResponse>(Object.assign({}, {...sampleAxiosResponse}, {data: []})))
        
        const result = await service.fetchClientNonIndividuals(sampleParams.page, sampleParams.size, sampleParams.sortedColumnName);
        expect(httpGetSpy).toHaveBeenCalled();
        expect(httpGetSpy).toHaveBeenCalledWith(expect.stringContaining(CLIENT_FETCH_ALL_API_PATH), { params: sampleParams });
        expect([]).toMatchObject<ClientAppIntegrationResponse[]>(result);
        expect(result.length).toBe(0);
    });

    it('Should return empty when CLIENT api returns undefined data.', async () => {
        httpGetSpy.mockReturnValue(of<AxiosResponse>(Object.assign({}, {...sampleAxiosResponse}, {data: undefined})))

        const result = await service.fetchClientNonIndividuals(sampleParams.page, sampleParams.size, sampleParams.sortedColumnName);
        expect(httpGetSpy).toHaveBeenCalled();
        expect(httpGetSpy).toHaveBeenCalledWith(expect.stringContaining(CLIENT_FETCH_ALL_API_PATH), { params: sampleParams });
        expect([]).toMatchObject<ClientAppIntegrationResponse[]>(result);
        expect(result.length).toBe(0);
    });

    it('Should return correct mapped data for subsequent calls to api', async () => {
      const callParams_1 = sampleParams;
      const callParams_2 = {...sampleParams, "page": callParams_1.page + 1};
      // custom http mocked implementation for this case.
      httpGetSpy.mockImplementation((_url: any, config: any) => {
        const params = config.params;
        if (params["page"] == callParams_1.page) { // page 0
          return of<AxiosResponse>(sampleAxiosResponse);
        }
        else if (params["page"] == callParams_2.page) { // page 1
          return of<AxiosResponse>(page2SampleAxiosResponse);
        }
        else { // page 2, stops.
          return of<AxiosResponse>({...sampleAxiosResponse, data: []});
        }
      })

      // First page request.
      let page = callParams_1.page;
      const expectP1MappedResult = getExpectMappedResult(sampleAxiosResponse);
      const result1 = await service.fetchClientNonIndividuals(
        page, callParams_1.size, callParams_1.sortedColumnName
      );
      expect(httpGetSpy).toHaveBeenCalledTimes(page + 1); // page starts as 0
      expect(httpGetSpy).toHaveBeenCalledWith(expect.stringContaining(CLIENT_FETCH_ALL_API_PATH), { params: callParams_1 });
      expect(expectP1MappedResult).toMatchObject<ClientAppIntegrationResponse[]>(result1);
      expect(expectP1MappedResult[0].id).toBe(sampleAxiosResponse.data[0].clientNumber);
      expect(expectP1MappedResult[0].name).toBe(sampleAxiosResponse.data[0].clientName);

      // Second page request.
      page = callParams_2.page;
      const expectP2MappedResult = getExpectMappedResult(page2SampleAxiosResponse);
      const result2 = await service.fetchClientNonIndividuals(
        page, callParams_2.size, callParams_2.sortedColumnName
      );
      expect(httpGetSpy).toHaveBeenCalledTimes(page + 1); // page starts as 0
      expect(httpGetSpy).toHaveBeenCalledWith(expect.stringContaining(CLIENT_FETCH_ALL_API_PATH), { params: callParams_2 });
      expect(expectP2MappedResult).toMatchObject<ClientAppIntegrationResponse[]>(result2);
      expect(expectP2MappedResult[0].id).toBe(page2SampleAxiosResponse.data[0].clientNumber);
      expect(expectP2MappedResult[0].name).toBe(page2SampleAxiosResponse.data[0].clientName);

      // Third page request should ends.
      page = callParams_2.page + 1;
      const callParams_3 = {...callParams_2, "page": page};
      const expectP3MappedResult = getExpectMappedResult({...sampleAxiosResponse, data: []}); // empty data returns;
      const result3 = await service.fetchClientNonIndividuals(
        page, callParams_3.size, callParams_3.sortedColumnName
      );
      expect(httpGetSpy).toHaveBeenCalledTimes(page + 1); // page starts as 0
      expect(httpGetSpy).toHaveBeenCalledWith(expect.stringContaining(CLIENT_FETCH_ALL_API_PATH), { params: callParams_3 });
      expect(expectP3MappedResult.length).toBe(0);
      expect(result3.length).toBe(0);
    });

    it('Should throw error when api returns error.', async () => {
      const failed403Error = new AxiosError(
        'You cannot consume this service', // CLIENT message for 403.
        '403'
      );
      httpGetSpy.mockImplementation((_url: any, _config: any) => {
        throw failed403Error;
      });

      const resultExpect = await expect(
        () => service.fetchClientNonIndividuals(
          sampleParams.page, sampleParams.size, sampleParams.sortedColumnName
        )
      )

      resultExpect.rejects.toBeInstanceOf(AxiosError);
      resultExpect.rejects.toThrow(failed403Error);
    });
  });

});

// --- Dependencies mock setup.

function provideDependencyMock(): Array<any> {
    const dependencyMock = [
      {
        provide: HttpService,
        useValue: {
          get: jest.fn()
        }
      },
      {
        provide: PinoLogger,
        useValue: {
          info: jest.fn((x) => x),
          setContext: jest.fn((x) => x),
        }
      },
      ClientAppIntegrationService
    ]
    return dependencyMock;
}

// --- Helper functions and objects.

function getExpectMappedResult(response: AxiosResponse): ClientAppIntegrationResponse[] {
  return response.data.map((item: any)=> {
    const mapped = new ClientAppIntegrationResponse();
    mapped.id = item.clientNumber;
    mapped.name = item.clientName;
    mapped.clientStatusCode = item.clientStatusCode;
    mapped.clientTypeCode = item.clientTypeCode;
    return mapped;
  });
}

const sampleAxiosResponse: AxiosResponse = {
    data: [
        {
          clientNumber: '00000001',
          clientName: 'MANAGEMENT ABEYANCE',
          clientStatusCode: 'ACT',
          clientTypeCode: 'C'
        },
        {
          clientNumber: '00000002',
          clientName: 'PENDING S & R BILLING',
          clientStatusCode: 'DAC',
          clientTypeCode: 'G'
        }],
    status: 200,
    statusText: 'OK',
    config: {
        headers: new AxiosHeaders()
    },
    headers: {},
};

const page2SampleAxiosResponse: AxiosResponse = {...sampleAxiosResponse, data: [
  {
    clientNumber: '00001001',
    clientName: 'MANAGEMENT ABEYANCE 2',
    clientStatusCode: 'DAC',
    clientTypeCode: 'G'
  },
  {
    clientNumber: '00001002',
    clientName: 'PENDING S & R BILLING 2',
    clientStatusCode: 'ACT',
    clientTypeCode: 'C'
  }
]};

