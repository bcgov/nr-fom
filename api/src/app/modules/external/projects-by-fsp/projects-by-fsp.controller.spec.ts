import { BadRequestException } from '@nestjs/common';
import { mockLoggerFactory } from '../../../factories/mock-logger.factory';
import { PositiveIntPipe, ProjectsByFspController } from './projects-by-fsp.controller';
import { ProjectsByFspService } from './projects-by-fsp.service';

describe('PositiveIntPipe', () => {
  let pipe: PositiveIntPipe;

  beforeEach(() => {
    pipe = new PositiveIntPipe();
  });

  it('transforms valid positive integer string', () => {
    expect(pipe.transform('123', {} as any)).toBe('123');
    expect(pipe.transform('2147483647', {} as any)).toBe('2147483647');
  });

  it('rejects zero and negative numbers', () => {
    expect(() => pipe.transform('0', {} as any)).toThrow(BadRequestException);
    expect(() => pipe.transform('-5', {} as any)).toThrow(BadRequestException);
  });

  it('rejects numbers exceeding 32-bit signed integer max', () => {
    expect(() => pipe.transform('2147483648', {} as any)).toThrow(BadRequestException);
    expect(() => pipe.transform('9999999999', {} as any)).toThrow(BadRequestException);
  });

  it('rejects non-numeric characters', () => {
    expect(() => pipe.transform('abc', {} as any)).toThrow(BadRequestException);
    expect(() => pipe.transform('12.34', {} as any)).toThrow(BadRequestException);
  });
});

describe('ProjectsByFspController', () => {
  let controller: ProjectsByFspController;
  let service: Partial<ProjectsByFspService>;

  beforeEach(() => {
    service = {
      findByFspId: jest.fn().mockResolvedValue([]),
    };
    controller = new ProjectsByFspController(service as ProjectsByFspService, mockLoggerFactory());
  });

  it('delegates findByFsp to service.findByFspId', async () => {
    const result = await controller.findByFsp(42);
    expect(result).toEqual([]);
    expect(service.findByFspId).toHaveBeenCalledWith(42);
  });
});
