import { PROJECT_ID_PARAM_KEY } from '@admin-core/utils/constants';
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn, RouterStateSnapshot } from '@angular/router';
import { ProjectMetricsResponse, ProjectResponse, ProjectService, SpatialFeaturePublicResponse, SpatialFeatureService } from '@api-client';

export const projectDetailResolver: ResolveFn<ProjectResponse> = 
    (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
        const projectId = parseInt(route.paramMap.get(PROJECT_ID_PARAM_KEY) ?? '');
        const projectService = inject(ProjectService)
        if (isNaN(projectId)) {
            return projectService.projectControllerFindOne(projectId)
          } else {
            // view/edit existing application
            return projectService.projectControllerFindOne(projectId);
          }
    };

export const projectMetricsDetailResolver: ResolveFn<ProjectMetricsResponse> = 
    (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
        const projectId = parseInt(route.paramMap.get(PROJECT_ID_PARAM_KEY) ?? '');
        const projectService = inject(ProjectService)
        return projectService.projectControllerFindProjectMetrics(projectId);
    };

export const projectSpatialDetailResolver: ResolveFn<Array<SpatialFeaturePublicResponse>> = 
    (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
        const projectId = parseInt(route.paramMap.get(PROJECT_ID_PARAM_KEY) ?? '');
        const spatialFeatureService = inject(SpatialFeatureService)
        return spatialFeatureService.spatialFeatureControllerGetForProject(projectId);
    }; 