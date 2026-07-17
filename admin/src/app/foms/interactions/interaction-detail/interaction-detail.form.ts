import { InteractionResponse } from '@api-client';
import { minLength, prop, required } from "@rxweb/reactive-form-validators";
import { DateTime } from 'luxon';
import * as R from 'remeda';

const UPDATE_FIELDS = ['stakeholder', 'communicationDate', 'communicationDetails'] as const;

export class InteractionDetailForm implements Pick<InteractionRequest, typeof UPDATE_FIELDS[number]> {
  @prop()
  stakeholder: string = '';

  /* 
  FORM field for binding to the datePicker, the value will later be converted to 'communicationDate'
  in the body when saving interaction to the backend.
  */
  @required()
  @prop()
  communicationDatePickerDate: Date;

  @required()
  @minLength({value: 1})
  @prop()
  communicationDetails: string = '';

  @prop()
  filename: string = null;

  @prop()
  fileContent: any = null;

  communicationDate: string = '';

  constructor(interaction: InteractionResponse) {
    if (interaction) {
      Object.assign(this, R.pick(interaction, UPDATE_FIELDS));
      const cmDate = DateTime.fromISO(this.communicationDate) // convert for datePicker
      this.communicationDatePickerDate = cmDate.isValid? cmDate.toJSDate() : null
    }
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
