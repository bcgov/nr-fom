import { TestBed } from '@angular/core/testing';
import { SpatialObjectCodeEnum, SubmissionTypeCodeEnum } from '@api-client';
import { ReactiveFormConfig, RxFormBuilder, RxFormGroup } from '@rxweb/reactive-form-validators';
import { FomSubmissionForm } from './fom-submission.form';

describe('FomSubmissionForm', () => {
  let formBuilder: RxFormBuilder;

  beforeAll(() => {
    ReactiveFormConfig.set({
      validationMessage: {
        required: 'This field is required.'
      }
    });
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RxFormBuilder]
    });
    formBuilder = TestBed.inject(RxFormBuilder);
  });

  function createFormGroup(initial?: Partial<FomSubmissionForm>): RxFormGroup {
    const formModel = new FomSubmissionForm();
    if (initial) {
      Object.assign(formModel, initial);
    }
    return formBuilder.formGroup(formModel) as RxFormGroup;
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
