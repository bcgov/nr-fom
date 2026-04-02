import { TestBed } from '@angular/core/testing';
import { ActivatedRouteStub } from './helpers';

describe('ActivatedRouteStub', () => {
  it('should create an instance', () => {
    const stub = new ActivatedRouteStub();
    expect(stub).toBeTruthy();
  });

  it('should set data', () => {
    const stub = new ActivatedRouteStub();
    stub.setData({ foo: 'bar' });
    stub.data.subscribe(data => {
      expect(data.foo).toBe('bar');
    });
  });

  it('should set params', () => {
    const stub = new ActivatedRouteStub();
    stub.setParams({ id: 123 });
    stub.params.subscribe(params => {
      expect(params.id).toBe(123);
    });
  });
});
