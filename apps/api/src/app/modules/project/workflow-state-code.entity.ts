import { ApiCodeTableEntity } from '@entities';
import { Entity } from 'typeorm';

@Entity('workflow_state_code', { schema: 'app_fom' })
export class WorkflowStateCode extends ApiCodeTableEntity<WorkflowStateCode> {
  constructor(workflowStateCode?: Partial<WorkflowStateCode>) {
    super(workflowStateCode);
  }

  static CODES = {
    INITIAL: 'INITIAL',
    COMMENT_OPEN: 'COMMENT_OPEN',
    COMMENT_CLOSED: 'COMMENT_CLOSED',
    FINALIZED: 'FINALIZED',
    EXPIRED: 'EXPIRED'
  };
}
