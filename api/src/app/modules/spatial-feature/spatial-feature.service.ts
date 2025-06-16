import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PinoLogger } from 'nestjs-pino';
import { Repository } from 'typeorm';
import { WorkflowStateEnum } from '../project/workflow-state-code.entity';
import { FeatureTypeCode } from './feature-type-code';
import { SpatialFeatureBcgwResponse, SpatialFeaturePublicResponse } from './spatial-feature.dto';
import { SpatialFeature } from './spatial-feature.entity';
import dayjs = require('dayjs');

@Injectable()
export class SpatialFeatureService {
  
  constructor(
    @InjectRepository(SpatialFeature)
    private spatialFeatureRepository: Repository<SpatialFeature>,
    private logger: PinoLogger) {
    
    logger.setContext(this.constructor.name);
  }

// Because this is based on a view designed to provide an API response, no separate DTO object is used - the entity is returned directly.
async findByProjectId(projectId: number): Promise<SpatialFeaturePublicResponse[]> {
    this.logger.debug(`${this.constructor.name}.findByProjectId id = ` + projectId);

    const result = await this.spatialFeatureRepository.find({
      where: { projectId: projectId },
      relations: ['submissionType'],
    });

    return result.map((entity) => {
      return this.convertEntityToPublicResponse(entity);
    });
  }

  // Because this is based on a view designed to provide an API response, no separate DTO object is used - the entity is returned directly.
  async getBcgwExtract(): Promise<SpatialFeatureBcgwResponse[]> {

    const query = this.spatialFeatureRepository.createQueryBuilder("f")
    .leftJoinAndSelect("f.forestClient", "forestClient")
    .leftJoinAndSelect("f.submissionType", "submissionType")
    .andWhere("f.workflow_state_code IN (:...workflowStateCodes)", 
      { workflowStateCodes: [WorkflowStateEnum.COMMENT_OPEN, WorkflowStateEnum.COMMENT_CLOSED, WorkflowStateEnum.FINALIZED] })
    ;
    // Don't do any sorting to minimize performance impact. BCGW's processing won't care about sort order.

    const result: SpatialFeature[] = await query.getMany();

    return result.map((entity) => {
      return this.convertEntityToBcgwResponse(entity);
    });
  }

  private convertEntityToPublicResponse( entity: SpatialFeature): SpatialFeaturePublicResponse {
    const DATE_FORMAT = 'YYYY-MM-DD';
    const response = new SpatialFeaturePublicResponse();
    response.featureId = entity.featureId;
    response.featureType = FeatureTypeCode.getInstance(entity.featureType);
    response.centroid = JSON.parse(entity.centroid);
    response.geometry = JSON.parse(entity.geometry);
    response.submissionType = entity.submissionType;

    if (entity.name) {
      response.name = entity.name;
    }

    if (entity.plannedAreaHa) {
      response.plannedAreaHa = entity.plannedAreaHa;
    }
    if (entity.plannedLengthKm) {
      response.plannedLengthKm = entity.plannedLengthKm;
    }
    if (entity.plannedDevelopmentDate) {
      response.plannedDevelopmentDate = dayjs(entity.plannedDevelopmentDate).format(DATE_FORMAT);
    }

    return response;
  }

  private convertEntityToBcgwResponse(entity: SpatialFeature): SpatialFeatureBcgwResponse {
    const DATE_FORMAT = 'YYYY-MM-DD';
    const response = new SpatialFeatureBcgwResponse();
    response.createDate = dayjs(entity.createTimestamp).format(DATE_FORMAT);
    response.featureId = entity.featureId;
    response.featureType = entity.featureType;
    response.fomId = entity.projectId;
    response.fspHolderName = entity.forestClient.name;
    response.geometry = JSON.parse(entity.geometry);
    response.lifecycleStatus = entity.submissionType.description;
    response.name = entity.name || '';
    response.fom_name = entity.fom_name || '';
    if (entity.plannedAreaHa) {
      response.plannedAreaHa = entity.plannedAreaHa;
    }
    if (entity.plannedLengthKm) {
      response.plannedLengthKm = entity.plannedLengthKm;
    }
    if (entity.plannedDevelopmentDate) {
      response.plannedDevelopmentDate = dayjs(entity.plannedDevelopmentDate).format(DATE_FORMAT);
    }
    
    return response;
  }
}
