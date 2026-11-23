import { FormControl, FormGroup } from '@angular/forms';
import { minLengthMsg, requiredMsg } from '@admin-core/utils/form-validators';
import { SpatialObjectCodeEnum, SubmissionRequest, SubmissionTypeCodeEnum } from '@api-client';
import * as R from 'remeda';

const updateFields = [
  'projectId',
  'submissionTypeCode',
  'spatialObjectCode',
  'jsonSpatialSubmission',
] as const;

export class FomSubmissionForm implements Pick<SubmissionRequest, (typeof updateFields)[number]> {
  projectId!: number;
  submissionTypeCode!: SubmissionTypeCodeEnum;
  spatialObjectCode!: SpatialObjectCodeEnum;
  jsonSpatialSubmission!: object;

  constructor(submission?: Partial<SubmissionRequest>) {
    if (submission) {
      Object.assign(this, R.pick(submission, updateFields));
    }
  }

  toFormGroup(): FormGroup {
    return new FormGroup({
      projectId: new FormControl(this.projectId ?? null, [requiredMsg(), minLengthMsg(5)]),
      submissionTypeCode: new FormControl(this.submissionTypeCode ?? null, [requiredMsg()]),
      spatialObjectCode: new FormControl(this.spatialObjectCode ?? null, [requiredMsg()]),
      jsonSpatialSubmission: new FormControl(this.jsonSpatialSubmission ?? null, [
        requiredMsg(),
        minLengthMsg(1),
      ]),
    });
  }
}
