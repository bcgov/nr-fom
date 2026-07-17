import { DistrictResponse, ResponseCode, WorkflowStateCode } from '@api-client';

export interface CodeTables {
  responseCode: ResponseCode[],
  district: DistrictResponse[],
  workflowStateCode: WorkflowStateCode[]
}
