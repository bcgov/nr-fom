import { ActivatedRouteStub } from './helpers';

describe('ActivatedRouteStub', () => {
  it('should create an instance', () => {
    const stub = new ActivatedRouteStub();
    expect(stub).toBeTruthy();
  });

  it('should set data', () => {
    const stub = new ActivatedRouteStub();
    stub.setData({ foo: 'bar' });
    stub.data.subscribe((data: any) => {
      expect(data.foo).toBe('bar');
    });
  });

  it('should set params', () => {
    const stub = new ActivatedRouteStub();
    stub.setParams({ id: 123 });
    stub.params.subscribe((params: any) => {
      expect(params.id).toBe(123);
    });
  });
});
