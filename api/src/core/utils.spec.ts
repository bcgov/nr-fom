import { Test, TestingModule } from '@nestjs/testing';
import { flatDeep } from './utils';

describe('flatDeep', () => {
  it('should flatten nested arrays', () => {
    const arr = [ 1, [ 2, [ 3, [ 4 ] ], 5 ] ];
    expect(flatDeep(arr, 10)).toEqual([ 1, 2, 3, 4, 5 ]);
  });

  it('should return empty array if input is empty', () => {
    expect(flatDeep([])).toEqual([]);
  });

  it('should handle non-array input', () => {
    expect(flatDeep(1)).toEqual([ 1 ]);
  });
});
