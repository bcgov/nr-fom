import {minLength, prop, required} from '@rxweb/reactive-form-validators';
import {SubmissionRequest, SpatialObjectCodeEnum, SubmissionTypeCodeEnum} from '@api-client';
import * as R from 'remeda';

const updateFields = [
  'projectId',
  'submissionTypeCode',
  'spatialObjectCode',
  'jsonSpatialSubmission'
] as const;

export class FomSubmissionForm implements Pick<SubmissionRequest,
  typeof updateFields[number]> {

  @prop()
  @required()
  @minLength({value: 5})
  projectId: number;


  @prop()
  @required()
  submissionTypeCode: SubmissionTypeCodeEnum;

  @prop()
  @required()
  spatialObjectCode: SpatialObjectCodeEnum;

  @prop()
  @required()
  @minLength({value: 1})

  jsonSpatialSubmission: object;

  constructor(submission?: Partial<SubmissionRequest>) {
    if (submission) {
      Object.assign(this, R.pick(submission, updateFields));
    }
  }

}
