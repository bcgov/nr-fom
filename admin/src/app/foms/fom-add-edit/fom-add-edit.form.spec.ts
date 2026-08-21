import { TestBed } from '@angular/core/testing';
import { ProjectPlanCodeEnum } from '@api-client';
import { ReactiveFormConfig, RxFormBuilder, RxFormGroup } from '@rxweb/reactive-form-validators';
import { FomAddEditForm } from './fom-add-edit.form';

describe('FomAddEditForm', () => {
  let formBuilder: RxFormBuilder;

  beforeAll(() => {
    ReactiveFormConfig.set({
      validationMessage: {
        required: 'This field is required.',
        minLength: 'Minimum length not met.',
        numeric: 'Must be a number.',
        pattern: 'Invalid format.'
      }
    });
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RxFormBuilder]
    });
    formBuilder = TestBed.inject(RxFormBuilder);
  });

  function createFormGroup(initial?: Partial<FomAddEditForm>): RxFormGroup {
    const formModel = new FomAddEditForm();
    if (initial) {
      Object.assign(formModel, initial);
    }
    return formBuilder.formGroup(formModel) as RxFormGroup;
  }

  describe('Core field validations', () => {
    it('invalidates empty form on required fields', () => {
      const form = createFormGroup();
      expect(form.valid).toBe(false);
      expect(form.controls['name'].valid).toBe(false);
      expect(form.controls['description'].valid).toBe(false);
      expect(form.controls['district'].valid).toBe(false);
      expect(form.controls['forestClient'].valid).toBe(false);
    });

    it('validates name minimum length of 5', () => {
      const form = createFormGroup({ name: 'ABCD' });
      expect(form.controls['name'].valid).toBe(false);

      form.controls['name'].setValue('ABCDE');
      expect(form.controls['name'].valid).toBe(true);
    });
  });

  describe('Conditional Project Plan Code validations', () => {
    it('requires fspId when projectPlanCode is FSP', () => {
      const form = createFormGroup();
      form.controls['projectPlanCode'].setValue(ProjectPlanCodeEnum.Fsp);
      form.controls['fspId'].setValue(null);

      expect(form.controls['fspId'].valid).toBe(false);
      expect(form.controls['woodlotLicenseNumber'].valid).toBe(true);

      form.controls['fspId'].setValue(1055);
      expect(form.controls['fspId'].valid).toBe(true);
    });

    it('requires woodlotLicenseNumber matching pattern W#### when projectPlanCode is WOODLOT', () => {
      const form = createFormGroup();
      form.controls['projectPlanCode'].setValue(ProjectPlanCodeEnum.Woodlot);
      form.controls['woodlotLicenseNumber'].setValue(null);

      expect(form.controls['woodlotLicenseNumber'].valid).toBe(false);
      expect(form.controls['fspId'].valid).toBe(true);

      // Invalid format
      form.controls['woodlotLicenseNumber'].setValue('1234');
      expect(form.controls['woodlotLicenseNumber'].valid).toBe(false);

      form.controls['woodlotLicenseNumber'].setValue('W123');
      expect(form.controls['woodlotLicenseNumber'].valid).toBe(false);

      // Valid format
      form.controls['woodlotLicenseNumber'].setValue('W1234');
      expect(form.controls['woodlotLicenseNumber'].valid).toBe(true);
    });
  });

  describe('BCTS Manager Name conditional validation', () => {
    it('requires bctsMgrName only when forestClient name includes TIMBER SALES MANAGER', () => {
      const form = createFormGroup();
      form.controls['forestClient'].setValue({ id: 1, name: 'BC TIMBER SALES MANAGER - BABINE' });
      form.controls['bctsMgrName'].setValue(null);

      expect(form.controls['bctsMgrName'].valid).toBe(false);

      form.controls['bctsMgrName'].setValue('Jane Doe');
      expect(form.controls['bctsMgrName'].valid).toBe(true);
    });

    it('does not require bctsMgrName for regular forest clients', () => {
      const form = createFormGroup();
      form.controls['forestClient'].setValue({ id: 2, name: 'CANFOR CORP' });
      form.controls['bctsMgrName'].setValue(null);

      expect(form.controls['bctsMgrName'].valid).toBe(true);
    });
  });

  describe('Proposed operations year initialization', () => {
    it('initializes opStartDate and opEndDate from numeric project operation years', () => {
      const model = new FomAddEditForm({
        operationStartYear: 2026,
        operationEndYear: 2029
      } as any);

      expect(model.opStartDate).toBeDefined();
      expect(model.opStartDate.getFullYear()).toBe(2026);
      expect(model.opEndDate).toBeDefined();
      expect(model.opEndDate.getFullYear()).toBe(2029);
    });
  });
});
