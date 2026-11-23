import { FormGroup } from '@angular/forms';
import { SpatialObjectCodeEnum, SubmissionTypeCodeEnum } from '@api-client';
import { FomSubmissionForm } from './fom-submission.form';

describe('FomSubmissionForm', () => {
  function createFormGroup(initial?: Partial<FomSubmissionForm>): FormGroup {
    const formModel = new FomSubmissionForm();
    if (initial) {
      Object.assign(formModel, initial);
    }
    return formModel.toFormGroup();
  }

  it('validates required fields for spatial submission', () => {
    const form = createFormGroup();
    expect(form.valid).toBe(false);
    expect(form.controls['projectId'].valid).toBe(false);
    expect(form.controls['submissionTypeCode'].valid).toBe(false);
    expect(form.controls['spatialObjectCode'].valid).toBe(false);
    expect(form.controls['jsonSpatialSubmission'].valid).toBe(false);
  });

  it('passes validation with valid submission properties', () => {
    const form = createFormGroup({
      projectId: 12345,
      submissionTypeCode: SubmissionTypeCodeEnum.Proposed,
      spatialObjectCode: SpatialObjectCodeEnum.CutBlock,
      jsonSpatialSubmission: { type: 'FeatureCollection', features: [] }
    });

    expect(form.valid).toBe(true);
  });
});
