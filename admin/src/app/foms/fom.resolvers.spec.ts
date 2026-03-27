import { TestBed } from '@angular/core/testing';
import { projectDetailResolver, projectMetricsDetailResolver, projectSpatialDetailResolver } from './fom.resolvers';
import { ProjectService, SpatialFeatureService } from '@api-client';
import { of } from 'rxjs';
import { ActivatedRouteSnapshot } from '@angular/router';

describe('FOM Resolvers', () => {
  let projectServiceMock: jest.Mocked<ProjectService>;
  let spatialFeatureServiceMock: jest.Mocked<SpatialFeatureService>;

  beforeEach(() => {
    projectServiceMock = {
      projectControllerFindOne: jest.fn(),
      projectControllerFindProjectMetrics: jest.fn(),
    } as any;
    spatialFeatureServiceMock = {
      spatialFeatureControllerGetForProject: jest.fn(),
    } as any;

    TestBed.configureTestingModule({
      providers: [
        { provide: ProjectService, useValue: projectServiceMock },
        { provide: SpatialFeatureService, useValue: spatialFeatureServiceMock },
      ],
    });
  });

  it('should resolve project details', () => {
    projectServiceMock.projectControllerFindOne.mockReturnValue(of({ id: 1 }) as any);
    const route = { paramMap: { get: () => '1' } } as any as ActivatedRouteSnapshot;
    const result = TestBed.runInInjectionContext(() => projectDetailResolver(route, null));
    expect(result).toBeDefined();
  });

  it('should resolve project metrics', () => {
    projectServiceMock.projectControllerFindProjectMetrics.mockReturnValue(of({ metrics: true }) as any);
    const route = { paramMap: { get: () => '1' } } as any as ActivatedRouteSnapshot;
    const result = TestBed.runInInjectionContext(() => projectMetricsDetailResolver(route, null));
    expect(result).toBeDefined();
  });

  it('should resolve project spatial details', () => {
    spatialFeatureServiceMock.spatialFeatureControllerGetForProject.mockReturnValue(of([{ id: 1 }]) as any);
    const route = { paramMap: { get: () => '1' } } as any as ActivatedRouteSnapshot;
    const result = TestBed.runInInjectionContext(() => projectSpatialDetailResolver(route, null));
    expect(result).toBeDefined();
  });
});
