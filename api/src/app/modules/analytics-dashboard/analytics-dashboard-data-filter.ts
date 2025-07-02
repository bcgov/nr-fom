import { SelectQueryBuilder } from 'typeorm';
import { WorkflowStateEnum } from '@api-modules/project/workflow-state-code.entity';

export function applyFomDateAndStateFilters<T>(
  qb: SelectQueryBuilder<T>,
  startDate: string,
  endDate: string,
  alias: string = 'p'
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
  startDate: string,
  endDate: string,
  alias: string = 'c'
): SelectQueryBuilder<T> {
  return qb
    .where(`${alias}.create_timestamp >= :startDate`, { startDate })
    .andWhere(`${alias}.create_timestamp <= :endDate`, { endDate });
}
