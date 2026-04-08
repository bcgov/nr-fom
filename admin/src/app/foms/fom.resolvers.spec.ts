import { TestBed } from '@angular/core/testing';
import { projectDetailResolver, projectMetricsDetailResolver, projectSpatialDetailResolver } from './fom.resolvers';
import { ProjectService, SpatialFeatureService } from '@api-client';
import { of } from 'rxjs';

describe('FOM Resolvers', () => {
  let projectServiceSpy: jest.Mocked<ProjectService>;
  let spatialFeatureServiceSpy: jest.Mocked<SpatialFeatureService>;

  beforeEach(() => {
    projectServiceSpy = {
      projectControllerFindOne: jest.fn(),
      projectControllerFindProjectMetrics: jest.fn(),
    } as unknown as jest.Mocked<ProjectService>;
    spatialFeatureServiceSpy = {
      spatialFeatureControllerGetForProject: jest.fn(),
    } as unknown as jest.Mocked<SpatialFeatureService>;

    TestBed.configureTestingModule({
      providers: [
        { provide: ProjectService, useValue: projectServiceSpy },
        { provide: SpatialFeatureService, useValue: spatialFeatureServiceSpy },
      ],
    });
  });

  it('should resolve project details', () => {
    const route: any = { paramMap: { get: () => '1' } };
    projectServiceSpy.projectControllerFindOne.mockReturnValue(of({ id: 1 }) as any);
    const result = TestBed.runInInjectionContext(() => projectDetailResolver(route, null));
    expect(result).toBeDefined();
  });

  it('should resolve project metrics', () => {
    const route: any = { paramMap: { get: () => '1' } };
    projectServiceSpy.projectControllerFindProjectMetrics.mockReturnValue(of({ metrics: true }) as any);
    const result = TestBed.runInInjectionContext(() => projectMetricsDetailResolver(route, null));
    expect(result).toBeDefined();
  });

  it('should resolve project spatial details', () => {
    const route: any = { paramMap: { get: () => '1' } };
    spatialFeatureServiceSpy.spatialFeatureControllerGetForProject.mockReturnValue(of([ { id: 1 } ]) as any);
    const result = TestBed.runInInjectionContext(() => projectSpatialDetailResolver(route, null));
    expect(result).toBeDefined();
  });
});
