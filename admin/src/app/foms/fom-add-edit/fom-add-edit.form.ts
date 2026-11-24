import { FormControl, FormGroup } from '@angular/forms';
import {
  alphaNumericMsg,
  bindConditionalRevalidation,
  conditionalValidator,
  maxLengthMsg,
  minDateMsg,
  minLengthMsg,
  numericMsg,
  patternMsg,
  requiredMsg,
} from '@admin-core/utils/form-validators';
import {
  DistrictResponse,
  ForestClientResponse,
  ProjectPlanCodeEnum,
  ProjectResponse,
  WorkflowStateCode,
} from '@api-client';
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
  'bctsMgrName',
] as const;

export class FomAddEditForm implements Pick<ProjectResponse, (typeof updateFields)[number]> {
  name!: string;
  description!: string;
  // Form starts with empty (null) date fields; populated to a string before submission.
  // `null!` keeps the existing null runtime default while satisfying the non-null ProjectResponse type.
  commentingOpenDate: string = null!;
  commentingClosedDate: string = null!;
  projectPlanCode: string = ProjectPlanCodeEnum.Fsp;
  fspId?: number = null!;
  woodlotLicenseNumber?: string = null!;
  district!: DistrictResponse;
  forestClient!: ForestClientResponse;
  workflowState!: WorkflowStateCode;
  opStartDate!: Date;
  opEndDate!: Date;
  bctsMgrName!: string;

  constructor(project?: Partial<ProjectResponse>) {
    if (project) {
      Object.assign(this, R.pick(project, updateFields));
    }

    this.initProposedOperations(project);
  }

  initProposedOperations(project: Partial<ProjectResponse> | undefined) {
    // Extra conversion for form: 'opStartDate' and 'opEndDate'
    if (project?.operationStartYear) {
      this.opStartDate = DateTime.now()
        .set({ year: project.operationStartYear })
        .set({ day: 1 }) // Does not matter for date, but set to first day for consistency later for comparison.
        .toJSDate();
    } else {
      // Setting default year
      this.opStartDate = DateTime.now().set({ day: 1 }).toJSDate();
    }

    if (project?.operationEndYear) {
      this.opEndDate = DateTime.now()
        .set({ year: project.operationEndYear })
        .set({ day: 1 }) // Does not matter for date, but set to first day for consistency later for comparison.
        .toJSDate();
    }
  }

  toFormGroup(): FormGroup {
    const fg = new FormGroup({
      name: new FormControl(this.name ?? null, [
        requiredMsg('FOM Name is required.'),
        minLengthMsg(5, 'Minimum length is 5'),
      ]),
      description: new FormControl(this.description ?? null, [
        requiredMsg('FOM Description is required.'),
      ]),
      commentingOpenDate: new FormControl(this.commentingOpenDate),
      commentingClosedDate: new FormControl(this.commentingClosedDate),
      projectPlanCode: new FormControl(this.projectPlanCode ?? null, [
        requiredMsg('Type of Plan Holder is required.'),
      ]),
      fspId: new FormControl(this.fspId ?? null, [
        conditionalValidator(
          (parent) => parent.get('projectPlanCode')?.value == ProjectPlanCodeEnum.Fsp,
          requiredMsg('FSP ID is required.')
        ),
        minLengthMsg(1),
        numericMsg('Must be a number.'),
      ]),
      woodlotLicenseNumber: new FormControl(this.woodlotLicenseNumber ?? null, [
        conditionalValidator(
          (parent) => parent.get('projectPlanCode')?.value == ProjectPlanCodeEnum.Woodlot,
          requiredMsg('Woodlot Licence Plan Number is required.')
        ),
        alphaNumericMsg('Only alpha-numberic characters are allowed.'),
        patternMsg('woodlotFormat', /^W\d{4}$/, 'Must starts with "W" followed by 4 digits.'),
      ]),
      district: new FormControl(this.district ?? null, [
        requiredMsg('District is required.'),
        minLengthMsg(1),
      ]),
      forestClient: new FormControl(this.forestClient ?? null, [
        requiredMsg('FOM Holder is required.'),
      ]),
      workflowState: new FormControl(this.workflowState ?? null),
      opStartDate: new FormControl(this.opStartDate ?? null, [
        requiredMsg('Start of Operations Year is required.'),
      ]),
      opEndDate: new FormControl(this.opEndDate ?? null, [
        requiredMsg('Operation End Year is required.'),
        conditionalValidator(
          (parent) => {
            const start = parent.get('opStartDate')?.value;
            const end = parent.get('opEndDate')?.value;
            if (!(start instanceof Date) || !(end instanceof Date)) {
              return false;
            }
            return DateTime.fromJSDate(start).year !== DateTime.fromJSDate(end).year;
          },
          minDateMsg(
            (parent) => parent?.get('opStartDate')?.value as Date | null,
            'Must be equal to or later than the Start of Operations'
          )
        ),
      ]),
      bctsMgrName: new FormControl(this.bctsMgrName ?? null, [
        conditionalValidator(
          (parent) => {
            const fc = parent.get('forestClient')?.value as ForestClientResponse | null | undefined;
            return !!fc?.name?.toUpperCase().includes('TIMBER SALES MANAGER');
          },
          requiredMsg('Timber Sales Manager Name is required.')
        ),
        minLengthMsg(3, 'Minimum length is 3'),
        maxLengthMsg(50, 'Maximum length is 50'),
      ]),
    });

    bindConditionalRevalidation(fg, 'projectPlanCode', ['fspId', 'woodlotLicenseNumber']);
    bindConditionalRevalidation(fg, 'forestClient', ['bctsMgrName']);
    bindConditionalRevalidation(fg, 'opStartDate', ['opEndDate']);
    return fg;
  }
}
