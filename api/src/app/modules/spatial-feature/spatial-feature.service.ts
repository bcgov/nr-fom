import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@utility/security/user';
import { PinoLogger } from 'nestjs-pino';
import { once } from 'node:events';
import { Writable } from 'node:stream';
import { DataSource, FindOptionsWhere, In, Repository } from 'typeorm';
import { ProjectService } from '../project/project.service';
import { WorkflowStateEnum } from '../project/workflow-state-code.entity';
import { FeatureTypeCode } from './feature-type-code';
import { SpatialFeatureBcgwResponse, SpatialFeaturePublicResponse } from './spatial-feature.dto';
import { SpatialFeature } from './spatial-feature.entity';
import dayjs = require('dayjs');

const DATE_FORMAT = 'YYYY-MM-DD';

const BCGW_EXTRACT_SQL = `
SELECT
  f.feature_id AS "featureId",
  f.feature_type AS "featureType",
  f.project_id AS "fomId",
  f.name AS "name",
  f.create_timestamp AS "createTimestamp",
  f.geojson AS "geometry",
  f.planned_development_date AS "plannedDevelopmentDate",
  f.planned_area_ha AS "plannedAreaHa",
  f.planned_length_km AS "plannedLengthKm",
  fc.name AS "fspHolderName",
  st.description AS "lifecycleStatus"
FROM app_fom.spatial_feature f
LEFT JOIN app_fom.forest_client fc ON fc.forest_client_number = f.forest_client_number
LEFT JOIN app_fom.submission_type_code st ON st.code = f.submission_type_code
WHERE f.workflow_state_code IN ($1, $2, $3)
`;

const BCGW_EXTRACT_PARAMS: string[] = [
  WorkflowStateEnum.COMMENT_OPEN,
  WorkflowStateEnum.COMMENT_CLOSED,
  WorkflowStateEnum.FINALIZED,
];

// ponytail: FETCH size bounds heap to one batch; drop to 1 if a single geometry is huge.
const BCGW_EXTRACT_FETCH_SIZE = 100;

export type BcgwExtractRow = {
  featureId: number | string;
  featureType: string;
  fomId: number | string;
  name: string | null;
  createTimestamp: Date | string;
  geometry: string;
  plannedDevelopmentDate: Date | string | null;
  plannedAreaHa: number | string | null;
  plannedLengthKm: number | string | null;
  fspHolderName: string | null;
  lifecycleStatus: string | null;
};

@Injectable()
export class SpatialFeatureService {
  
  constructor(
    @InjectRepository(SpatialFeature)
    private spatialFeatureRepository: Repository<SpatialFeature>,
    private projectService: ProjectService,
    private dataSource: DataSource,
    private logger: PinoLogger) {
    
    logger.setContext(this.constructor.name);
  }

  // Because this is based on a view designed to provide an API response, no separate DTO object is used - the entity is returned directly.
  async findByProjectId(projectId: number, user?: User): Promise<SpatialFeaturePublicResponse[]> {
    this.logger.debug(`${this.constructor.name}.findByProjectId id = ` + projectId);

    const project = await this.projectService.findOne(projectId, user);

    const isElevated =
      user?.isMinistry ||
      (user?.isForestClient && user.isAuthorizedForClientId(project.forestClient?.id));

    const where: FindOptionsWhere<SpatialFeature> = { projectId };
    if (!isElevated) {
      where.workflowStateCode = In([
        WorkflowStateEnum.COMMENT_OPEN,
        WorkflowStateEnum.COMMENT_CLOSED,
        WorkflowStateEnum.FINALIZED,
      ]);
    }

    const result = await this.spatialFeatureRepository.find({
      where,
      relations: { submissionType: true },
    });

    return result.map((entity) => {
      return this.convertEntityToPublicResponse(entity);
    });
  }

  /**
   * Streams a JSON array of SpatialFeatureBcgwResponse objects.
   * Rows are fetched from a server-side cursor so BCGW/FME pulls do not hold the full extract in heap.
   * @returns number of features written
   */
  async streamBcgwExtract(out: Writable): Promise<number> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    let featureCount = 0;
    try {
      await queryRunner.query(
        `DECLARE bcgw_extract NO SCROLL CURSOR FOR ${BCGW_EXTRACT_SQL}`,
        BCGW_EXTRACT_PARAMS);
      let first = true;
      await writeChunk(out, '[');
      for (;;) {
        const rows = await queryRunner.query(
          `FETCH ${BCGW_EXTRACT_FETCH_SIZE} FROM bcgw_extract`) as BcgwExtractRow[];
        if (!Array.isArray(rows)) {
          throw new InternalServerErrorException('BCGW extract FETCH returned a non-array');
        }
        if (!rows.length) {
          break;
        }
        for (const row of rows) {
          const featureJson = JSON.stringify(this.convertRowToBcgwResponse(row));
          if (!first) {
            await writeChunk(out, ',');
          }
          first = false;
          await writeChunk(out, featureJson);
          featureCount += 1;
        }
      }
      await writeChunk(out, ']');
      await queryRunner.query('CLOSE bcgw_extract');
      await queryRunner.commitTransaction();
      out.end();
      return featureCount;
    } catch (err) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  convertRowToBcgwResponse(row: BcgwExtractRow): SpatialFeatureBcgwResponse {
    if (row.fspHolderName == null || row.lifecycleStatus == null || row.geometry == null) {
      throw new InternalServerErrorException(
        'BCGW extract row missing forest client, submission type, or geometry');
    }

    const response = new SpatialFeatureBcgwResponse();
    response.createDate = dayjs(row.createTimestamp).format(DATE_FORMAT);
    response.featureId = Number(row.featureId);
    response.featureType = row.featureType;
    response.fomId = Number(row.fomId);
    response.fspHolderName = row.fspHolderName;
    response.geometry = JSON.parse(row.geometry);
    response.lifecycleStatus = row.lifecycleStatus;
    response.name = row.name || '';
    const plannedAreaHa = Number(row.plannedAreaHa);
    if (plannedAreaHa) {
      response.plannedAreaHa = plannedAreaHa;
    }
    const plannedLengthKm = Number(row.plannedLengthKm);
    if (plannedLengthKm) {
      response.plannedLengthKm = plannedLengthKm;
    }
    if (row.plannedDevelopmentDate) {
      response.plannedDevelopmentDate = dayjs(row.plannedDevelopmentDate).format(DATE_FORMAT);
    }

    return response;
  }

  private convertEntityToPublicResponse( entity: SpatialFeature): SpatialFeaturePublicResponse {
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
}

async function writeChunk(out: Writable, chunk: string): Promise<void> {
  if (!out.write(chunk)) {
    await once(out, 'drain');
  }
}
