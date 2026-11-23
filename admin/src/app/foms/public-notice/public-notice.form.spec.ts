import { FormGroup } from '@angular/forms';
import { DateTime } from 'luxon';
import { PublicNoticeForm } from './public-notice.form';

describe('PublicNoticeForm', () => {
  function createFormGroup(initial?: Partial<PublicNoticeForm>): FormGroup {
    const formModel = new PublicNoticeForm();
    if (initial) {
      Object.assign(formModel, initial);
    }
    return formModel.toFormGroup();
  }

  describe('Core validations', () => {
    it('invalidates empty form on required fields', () => {
      const form = createFormGroup();
      expect(form.valid).toBe(false);
      expect(form.controls['reviewAddress'].valid).toBe(false);
      expect(form.controls['reviewBusinessHours'].valid).toBe(false);
      expect(form.controls['mailingAddress'].valid).toBe(false);
      expect(form.controls['email'].valid).toBe(false);
    });

    it('validates email format', () => {
      const form = createFormGroup({ email: 'invalid-email' });
      expect(form.controls['email'].valid).toBe(false);

      form.controls['email'].setValue('valid.user@gov.bc.ca');
      expect(form.controls['email'].valid).toBe(true);
    });
  });

  describe('Conditional Receive Comments Same as Review', () => {
    it('requires receiveCommentsAddress and hours when isReceiveCommentsSameAsReview is false', () => {
      const form = createFormGroup();
      form.controls['isReceiveCommentsSameAsReview'].setValue(true);
      form.controls['isReceiveCommentsSameAsReview'].setValue(false);
      form.controls['receiveCommentsAddress'].setValue(null);
      form.controls['receiveCommentsBusinessHours'].setValue(null);

      expect(form.controls['receiveCommentsAddress'].valid).toBe(false);
      expect(form.controls['receiveCommentsBusinessHours'].valid).toBe(false);

      form.controls['receiveCommentsAddress'].setValue('123 Comment St');
      form.controls['receiveCommentsBusinessHours'].setValue('9am - 5pm');
      expect(form.controls['receiveCommentsAddress'].valid).toBe(true);
      expect(form.controls['receiveCommentsBusinessHours'].valid).toBe(true);
    });

    it('does not require receiveCommentsAddress when isReceiveCommentsSameAsReview is true', () => {
      const form = createFormGroup();
      form.controls['isReceiveCommentsSameAsReview'].setValue(true);

      expect(form.controls['receiveCommentsAddress'].valid).toBe(true);
      expect(form.controls['receiveCommentsBusinessHours'].valid).toBe(true);
    });
  });

  describe('Notice Post Date initialization', () => {
    it('converts postDate ISO string to JS Date', () => {
      const isoDate = DateTime.now().plus({ days: 3 }).toISODate()!;
      const model = new PublicNoticeForm({
        postDate: isoDate
      } as any);

      expect(model.pnPostDate).toBeDefined();
      expect(model.pnPostDate instanceof Date).toBe(true);
    });

    it('rejects past pnPostDate and whitespace-only required text fields', () => {
      const form = createFormGroup({
        reviewAddress: '   ',
        pnPostDate: DateTime.now().minus({ days: 1 }).toJSDate(),
      });
      expect(form.controls['reviewAddress'].hasError('notEmpty')).toBe(true);
      expect(form.controls['pnPostDate'].hasError('minDate')).toBe(true);
    });
  });
});
