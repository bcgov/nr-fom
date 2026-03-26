import { TestBed } from '@angular/core/testing';
import { projectDetailResolver, projectMetricsDetailResolver, projectSpatialDetailResolver } from './fom.resolvers';
import { ProjectService, SpatialFeatureService } from '@api-client';
import { of } from 'rxjs';

describe('FOM Resolvers', () => {
  let projectServiceSpy: jasmine.SpyObj<ProjectService>;
  let spatialFeatureServiceSpy: jasmine.SpyObj<SpatialFeatureService>;

  beforeEach(() => {
    projectServiceSpy = jasmine.createSpyObj('ProjectService', [
      'projectControllerFindOne',
      'projectControllerFindProjectMetrics',
    ]);
    spatialFeatureServiceSpy = jasmine.createSpyObj('SpatialFeatureService', [
      'spatialFeatureControllerGetForProject',
    ]);
  });

  it('should resolve project details', () => {
    const route: any = { paramMap: { get: () => '1' } };
    projectServiceSpy.projectControllerFindOne.and.returnValue(of({ id: 1 }));
    const result = projectDetailResolver(route, null);
    expect(result).toBeDefined();
  });

  it('should resolve project metrics', () => {
    const route: any = { paramMap: { get: () => '1' } };
    projectServiceSpy.projectControllerFindProjectMetrics.and.returnValue(of({ metrics: true }));
    const result = projectMetricsDetailResolver(route, null);
    expect(result).toBeDefined();
  });

  it('should resolve project spatial details', () => {
    const route: any = { paramMap: { get: () => '1' } };
    spatialFeatureServiceSpy.spatialFeatureControllerGetForProject.and.returnValue(of([ { id: 1 } ]));
    const result = projectSpatialDetailResolver(route, null);
    expect(result).toBeDefined();
  });
});
