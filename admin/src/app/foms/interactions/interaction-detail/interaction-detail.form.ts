import { FormControl, FormGroup } from '@angular/forms';
import { minLengthMsg, requiredMsg } from '@admin-core/utils/form-validators';
import { InteractionResponse } from '@api-client';
import { DateTime } from 'luxon';
import * as R from 'remeda';

const UPDATE_FIELDS = ['stakeholder', 'communicationDate', 'communicationDetails'] as const;

export class InteractionDetailForm implements Pick<InteractionRequest, (typeof UPDATE_FIELDS)[number]> {
  stakeholder = '';
  /*
  FORM field for binding to the datePicker, the value will later be converted to 'communicationDate'
  in the body when saving interaction to the backend.
  */
  communicationDatePickerDate: Date | null = null;
  communicationDetails = '';
  filename: string | null = null;
  fileContent: File | null = null;
  communicationDate = '';

  constructor(interaction: InteractionResponse) {
    if (interaction) {
      Object.assign(this, R.pick(interaction, UPDATE_FIELDS));
      const cmDate = DateTime.fromISO(this.communicationDate); // convert for datePicker
      this.communicationDatePickerDate = cmDate.isValid ? cmDate.toJSDate() : null;
    }
  }

  toFormGroup(): FormGroup {
    return new FormGroup({
      stakeholder: new FormControl(this.stakeholder ?? ''),
      communicationDatePickerDate: new FormControl(this.communicationDatePickerDate ?? null, [
        requiredMsg(),
      ]),
      communicationDetails: new FormControl(this.communicationDetails ?? '', [
        requiredMsg(),
        minLengthMsg(1),
      ]),
      filename: new FormControl(this.filename ?? null),
      fileContent: new FormControl(this.fileContent ?? null),
    });
  }
}

export interface InteractionRequest {
  projectId: number;
  stakeholder: string;
  communicationDate: string;
  communicationDatePickerDate: Date;
  communicationDetails: string;
  revisionCount: number;
  filename: string;
  fileContent: any;
}
