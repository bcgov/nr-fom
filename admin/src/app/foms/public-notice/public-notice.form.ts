import { FormControl, FormGroup } from '@angular/forms';
import {
  bindConditionalRevalidation,
  conditionalValidator,
  emailMsg,
  minDateMsg,
  notEmptyMsg,
  requiredMsg,
} from '@admin-core/utils/form-validators';
import { PublicNoticeResponse } from '@api-client';
import { DateTime } from 'luxon';
import * as R from 'remeda';

export class PublicNoticeForm {
  projectId!: number;
  publicNoticeId!: number;
  reviewAddress!: string;
  reviewBusinessHours!: string;
  isReceiveCommentsSameAsReview = false;
  receiveCommentsAddress!: string;
  receiveCommentsBusinessHours!: string;
  mailingAddress!: string;
  email!: string;
  pnPostDate!: Date;

  constructor(publicNoticeResponse?: PublicNoticeResponse) {
    const pn = publicNoticeResponse;
    if (pn) {
      // Pick the field to instantiate.
      Object.assign(
        this,
        R.pick(pn, [
          'projectId',
          'id',
          'reviewAddress',
          'reviewBusinessHours',
          'isReceiveCommentsSameAsReview',
          'receiveCommentsAddress',
          'receiveCommentsBusinessHours',
          'mailingAddress',
          'email',
        ])
      );
    }

    this.initProposedOperations(pn);
  }

  initProposedOperations(pn: PublicNoticeResponse | undefined) {
    if (pn?.postDate) {
      this.pnPostDate = DateTime.fromISO(pn.postDate).toJSDate();
    }
  }

  toFormGroup(): FormGroup {
    const isSameAsReviewFalse = (parent: FormGroup): boolean =>
      parent.get('isReceiveCommentsSameAsReview')?.value === false;

    const fg = new FormGroup({
      reviewAddress: new FormControl(this.reviewAddress ?? null, [
        requiredMsg('Address to Review FOM is required.'),
        notEmptyMsg('Address to Review FOM can not be empty.'),
      ]),
      reviewBusinessHours: new FormControl(this.reviewBusinessHours ?? null, [
        requiredMsg('Business Hours to Review FOM is required.'),
        notEmptyMsg('Business Hours to Review FOM can not be empty.'),
      ]),
      isReceiveCommentsSameAsReview: new FormControl(this.isReceiveCommentsSameAsReview, [
        requiredMsg('Receive Comments Same as Review Checkbox is required.'),
      ]),
      receiveCommentsAddress: new FormControl(this.receiveCommentsAddress ?? null, [
        conditionalValidator(isSameAsReviewFalse, requiredMsg('Address to Receive Comments is required.')),
        conditionalValidator(
          isSameAsReviewFalse,
          notEmptyMsg('Address to Receive Comments can not be empty.')
        ),
      ]),
      receiveCommentsBusinessHours: new FormControl(this.receiveCommentsBusinessHours ?? null, [
        conditionalValidator(
          isSameAsReviewFalse,
          requiredMsg('Business Hours to Receive Comments is required.')
        ),
        conditionalValidator(
          isSameAsReviewFalse,
          notEmptyMsg('Business Hours to Receive Comments can not be empty.')
        ),
      ]),
      mailingAddress: new FormControl(this.mailingAddress ?? null, [
        requiredMsg('Mailing Address is required.'),
        notEmptyMsg('Mailing Address can not be empty.'),
      ]),
      email: new FormControl(this.email ?? null, [
        requiredMsg('Email is required.'),
        emailMsg('Email format is invalid.'),
      ]),
      pnPostDate: new FormControl(this.pnPostDate ?? null, [
        minDateMsg(
          () => DateTime.now().plus({ days: 1 }).toISODate(),
          'Must publish notice one day in the future'
        ),
      ]),
    });

    bindConditionalRevalidation(fg, 'isReceiveCommentsSameAsReview', [
      'receiveCommentsAddress',
      'receiveCommentsBusinessHours',
    ]);
    return fg;
  }
}
