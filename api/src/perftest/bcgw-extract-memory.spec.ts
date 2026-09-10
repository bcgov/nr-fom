import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PinoLogger } from 'nestjs-pino';
import { PassThrough } from 'node:stream';
import { DataSource } from 'typeorm';
import { ProjectService } from '../app/modules/project/project.service';
import { SpatialFeature } from '../app/modules/spatial-feature/spatial-feature.entity';
import {
  BcgwExtractRow,
  SpatialFeatureService,
} from '../app/modules/spatial-feature/spatial-feature.service';

const RING: number[][] = Array.from({ length: 400 }, (_, i) => [
  -123 + i * 0.001,
  49 + (i % 40) * 0.001,
]);
RING.push(RING[0]);
const GEOMETRY = JSON.stringify({ type: 'Polygon', coordinates: [RING] });

const ROW_COUNT = 5000;
const FETCH_SIZE = 100;
const MAX_HEAP_GROWTH_BYTES = 32 * 1024 * 1024;

function gc(): void {
  const fn = (globalThis as { gc?: () => void }).gc;
  if (typeof fn === 'function') {
    fn();
  }
}

function makeRow(id: number): BcgwExtractRow {
  return {
    featureId: id,
    featureType: 'cut_block',
    fomId: id,
    name: `CB-${id}`,
    createTimestamp: '2026-01-02',
    geometry: GEOMETRY,
    plannedDevelopmentDate: '2026-03-01',
    plannedAreaHa: 1.5,
    plannedLengthKm: 0,
    fspHolderName: 'Acme',
    lifecycleStatus: 'Proposed',
  };
}

const enabled = process.env.BCGW_EXTRACT_STRESS === '1';

(enabled ? describe : describe.skip)('streamBcgwExtract memory bound', () => {
  it('keeps heap from growing with row count while streaming', async () => {
    const queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(),
      isTransactionActive: true,
    };

    const heapSamples: number[] = [];
    let fetchIndex = 0;
    const totalBatches = ROW_COUNT / FETCH_SIZE;
    queryRunner.query.mockImplementation(async (sql: string) => {
      if (!sql.startsWith('FETCH')) {
        return undefined;
      }
      gc();
      heapSamples.push(process.memoryUsage().heapUsed);
      if (fetchIndex >= totalBatches) {
        return [];
      }
      const batchStart = fetchIndex * FETCH_SIZE;
      fetchIndex += 1;
      return Array.from({ length: FETCH_SIZE }, (_, i) => makeRow(batchStart + i));
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpatialFeatureService,
        { provide: getRepositoryToken(SpatialFeature), useValue: { find: jest.fn() } },
        { provide: ProjectService, useValue: { findOne: jest.fn() } },
        { provide: DataSource, useValue: { createQueryRunner: () => queryRunner } },
        { provide: PinoLogger, useValue: { debug: jest.fn(), setContext: jest.fn(), info: jest.fn(), error: jest.fn() } },
      ],
    }).compile();

    const service = module.get(SpatialFeatureService);
    const out = new PassThrough();
    out.resume();

    const featureCount = await service.streamBcgwExtract(out);
    const early = heapSamples.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const late = heapSamples.slice(-5).reduce((a, b) => a + b, 0) / 5;

    expect(featureCount).toBe(ROW_COUNT);
    expect(queryRunner.query.mock.calls.filter(
      (call: [string]) => call[0].startsWith('FETCH')).length).toBe(totalBatches + 1);
    expect(late - early).toBeLessThan(MAX_HEAP_GROWTH_BYTES);
  });
});
