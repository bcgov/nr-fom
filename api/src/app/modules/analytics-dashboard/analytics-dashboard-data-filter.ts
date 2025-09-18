import { WorkflowStateEnum } from '@api-modules/project/workflow-state-code.entity';
import { SelectQueryBuilder } from 'typeorm';

export enum ProjectPlanCodeFilterEnum {
  FSP = 'FSP',
  WOODLOT = 'WOODLOT',
  ALL = 'ALL'
}

export function applyFomDateAndStateFilters<T>(
  qb: SelectQueryBuilder<T>,
  startDate: string,
  endDate: string,
  alias: string
): SelectQueryBuilder<T> {
  return qb
    .where(`${alias}.commenting_open_date >= :startDate`, { startDate })
    .andWhere(`${alias}.commenting_open_date <= :endDate`, { endDate })
    .andWhere(`${alias}.workflow_state_code != :workflowStateCode`, {
      workflowStateCode: WorkflowStateEnum.INITIAL,
    });
}

export function applyCommentCreateDateFilter<T>(
  qb: SelectQueryBuilder<T>,
  startDate: string, // YYYY-MM-DD
  endDate: string, // YYYY-MM-DD
  alias: string
): SelectQueryBuilder<T> {
  return qb
    // Note: 'create_timestamp' is a timestamp column and 'startDate' is a 'Date' string (no time portion).
    //       To compare, we can use DATE_TRUNC for extracting only 'Date' part from timestamp. Without
    //       it, will result into some missing edge data.
    .where(`DATE_TRUNC('day', ${alias}.create_timestamp) >= :startDate`,  { startDate })
    .andWhere(`DATE_TRUNC('day', ${alias}.create_timestamp) <= :endDate`, { endDate });
}

export function applyProjectPlanCodeFilter<T>(
  qb: SelectQueryBuilder<T>,
  projectPlanCode: ProjectPlanCodeFilterEnum,
  alias: string
): SelectQueryBuilder<T> {
  if (projectPlanCode === ProjectPlanCodeFilterEnum.ALL) {
    return qb.andWhere(`${alias}.project_plan_code IN (:...codes)`, { codes: [ProjectPlanCodeFilterEnum.FSP, ProjectPlanCodeFilterEnum.WOODLOT] });
  } else {
    return qb.andWhere(`${alias}.project_plan_code = :code`, { code: projectPlanCode });
  }
}
