import { PublicNoticeResponse } from "@api-client";
import { email, minDate, notEmpty, prop, required } from "@rxweb/reactive-form-validators";
import { DateTime } from "luxon";
import * as R from 'remeda';
export class PublicNoticeForm {

  projectId: number;

  publicNoticeId: number;

  @required({message: 'Address to Review FOM is required.'})
  @notEmpty({message: 'Address to Review FOM can not be empty.'})
  @prop()
  reviewAddress: string;

  @required({message: 'Business Hours to Review FOM is required.'})
  @notEmpty({message: 'Business Hours to Review FOM can not be empty.'})
  @prop()
  reviewBusinessHours: string;

  @required({message: 'Receive Comments Same as Review Checkbox is required.'})
  @prop()
  isReceiveCommentsSameAsReview: boolean = false;
  
  @required({
    conditionalExpression:(x: PublicNoticeForm) => x.isReceiveCommentsSameAsReview === false,
    message: 'Address to Receive Comments is required.'
  })
  @notEmpty({
    conditionalExpression:(x: PublicNoticeForm) => x.isReceiveCommentsSameAsReview === false,
    message: 'Address to Receive Comments can not be empty.'
  })
  @prop()
  receiveCommentsAddress: string;

  @required({
    conditionalExpression:(x: PublicNoticeForm) => x.isReceiveCommentsSameAsReview === false,
    message: 'Business Hours to Receive Comments is required.'
  })
  @notEmpty({
    conditionalExpression:(x: PublicNoticeForm) => x.isReceiveCommentsSameAsReview === false,
    message: 'Business Hours to Receive Comments can not be empty.'
  })
  @prop()
  receiveCommentsBusinessHours: string;

  @required({message: 'Mailing Address is required.'})
  @notEmpty({message: 'Mailing Address can not be empty.'})
  @prop()
  mailingAddress: string;

  @required({message: 'Email is required.'})
  @email({message: 'Email format is invalid.'})
  @prop()
  email: string;

  @minDate({
    value: DateTime.now().plus({days: 1}).toISODate(),
    message: 'Must publish notice one day in the future'})
  @prop()
  pnPostDate: Date;
  
  constructor(publicNoticeResponse?: PublicNoticeResponse) {
    const pn = publicNoticeResponse;
    if (pn) {
      // Pick the field to instantiate.
      Object.assign(this, R.pick(pn, 
        [
          'projectId',
          'id',
          'reviewAddress',
          'reviewBusinessHours',
          'isReceiveCommentsSameAsReview',
          'receiveCommentsAddress',
          'receiveCommentsBusinessHours',
          'mailingAddress',
          'email'
        ]
      ));
    }

    this.initProposedOperations(pn);
  }

  initProposedOperations(pn: PublicNoticeResponse | undefined) {
    if (pn?.postDate) {
        this.pnPostDate = DateTime.fromISO(pn.postDate).toJSDate();
    }
  }
}
