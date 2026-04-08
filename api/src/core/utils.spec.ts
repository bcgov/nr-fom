import { flatDeep } from './utils';

describe('flatDeep', () => {
  it('should flatten nested arrays with sufficient depth', () => {
    const arr = [ 1, [ 2, [ 3, [ 4 ] ], 5 ] ];
    expect(flatDeep(arr, 10)).toEqual([ 1, 2, 3, 4, 5 ]);
  });

  it('should flatten one level by default', () => {
    const arr = [ 1, [ 2, 3 ], [ 4, [ 5 ] ] ];
    expect(flatDeep(arr)).toEqual([ 1, 2, 3, 4, [ 5 ] ]);
  });

  it('should return empty array if input is empty', () => {
    expect(flatDeep([])).toEqual([]);
  });

  it('should return shallow copy when depth is 0', () => {
    const arr = [ 1, [ 2, [ 3 ] ] ];
    expect(flatDeep(arr, 0)).toEqual([ 1, [ 2, [ 3 ] ] ]);
  });
});
