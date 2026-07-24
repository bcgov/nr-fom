import { AbstractControl } from '@angular/forms';
import { DistrictResponse, ForestClientResponse, ProjectPlanCodeEnum, ProjectResponse, WorkflowStateCode } from '@api-client';
import { alphaNumeric, maxLength, minDate, minLength, numeric, pattern, prop, required } from '@rxweb/reactive-form-validators';
import { DateTime } from 'luxon';
import * as R from 'remeda';

const updateFields = [
  'name',
  'description',
  'commentingOpenDate',
  'commentingClosedDate',
  'projectPlanCode',
  'fspId',
  'woodlotLicenseNumber',
  'district',
  'forestClient',
  'workflowState',
  'bctsMgrName'
] as const;

export class FomAddEditForm implements Pick<ProjectResponse,
  typeof updateFields[number]> {

  @prop()
  @required({message: 'FOM Name is required.'})
  @minLength({value: 5, message: 'Minimum length is 5'})
  name: string;

  @prop()
  @required({message: 'FOM Description is required.'})
  description: string;

  // Form starts with empty (null) date fields; populated to a string before submission.
  // `null!` keeps the existing null runtime default while satisfying the non-null ProjectResponse type.
  @prop()
  commentingOpenDate: string = null!;

  @prop({})
  commentingClosedDate: string = null!;

  @prop()
  @required({message: 'Type of Plan Holder is required.'})
  projectPlanCode: string = ProjectPlanCodeEnum.Fsp

  @prop()
  @required({
    message: 'FSP ID is required.',
		conditionalExpression: (x: FomAddEditForm) => {
			return x.projectPlanCode == ProjectPlanCodeEnum.Fsp
		}
	})
  @minLength({value: 1})
  @numeric({message: 'Must be a number.'})
  fspId?: number = null!;

  @prop()
  @required({
    message: 'Woodlot Licence Plan Number is required.',
		conditionalExpression: (x: FomAddEditForm) => {
			return x.projectPlanCode == ProjectPlanCodeEnum.Woodlot
		}
	})
  @alphaNumeric({message: 'Only alpha-numberic characters are allowed.'})
  @pattern({
    expression:{'woodlotFormat': /^W\d{4}$/},
    message: 'Must starts with "W" followed by 4 digits.'
  })
  woodlotLicenseNumber?: string = null!;

  @prop()
  @required({message: 'District is required.'})
  @minLength({value: 1})
  district: DistrictResponse;

  @prop()
  @required({message: 'FOM Holder is required.'})
  forestClient: ForestClientResponse;

  @prop()
  workflowState: WorkflowStateCode;

  // Special case. It is at form control, but will be convert into request body for 'operationStartYear' (number).
  @required({message: 'Start of Operations Year is required.'})
  @prop()
  opStartDate: Date;

  // Special case. It is at form control, but will be convert into request body for 'operationEndYear' (number).
  @required({message: 'Operation End Year is required.'})
  @minDate({
    // In this case, do not use (x,y) arrow expression for validator. 
    // Use 'function(control)' expression, so it can get current field value through "this.".
    conditionalExpression: function(control: AbstractControl) {
      // For 'opStartDate' and 'opEndDate', only need "year" from the date; but still use "Date" type for datePicker.
      // (This is a tricky case to set up "conditionalExpression" validator for @minDate, as date is passed from datePicker)
      // So, conditionally, if years are the same, no need to validate on @minDate().
      const sameYear = DateTime.fromJSDate(this.opStartDate).year == DateTime.fromJSDate(this.opEndDate).year;
      return !sameYear;
    },
    fieldName:'opStartDate', message: 'Must be equal to or later than the Start of Operations'})
  @prop()
  opEndDate: Date;

  @prop()
  @required({
    conditionalExpression: (x: FomAddEditForm) => {
        return x.forestClient?.name.toUpperCase().includes('TIMBER SALES MANAGER')
    },
    message: 'Timber Sales Manager Name is required.', 
  })
  @minLength({value: 3, message: 'Minimum length is 3'})
  @maxLength({value: 50, message: 'Maximum length is 50'})
  bctsMgrName: string;

  constructor(project?: Partial<ProjectResponse>) {
    if (project) {

      Object.assign(this, R.pick(project, updateFields));
    }

    this.initProposedOperations(project);
  }

  initProposedOperations(project: Partial<ProjectResponse> | undefined) {
    // Extra conversion for form: 'opStartDate' and 'opEndDate'
    if (project?.operationStartYear) {
      this.opStartDate = DateTime.now().set({year: project.operationStartYear})
                                  .set({day: 1}) // Does not matter for date, but set to first day for consistency later for comparison.
                                  .toJSDate();
    }
    // Setting default year 
    else {
      this.opStartDate = DateTime.now().set({day: 1})
                                  .toJSDate();
    }

    if (project?.operationEndYear) {
      this.opEndDate = DateTime.now().set({year: project.operationEndYear})
                                  .set({day: 1}) // Does not matter for date, but set to first day for consistency later for comparison.
                                  .toJSDate();
    }
  }

}
