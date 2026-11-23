import { FormControl, FormGroup } from '@angular/forms';
import {
  alphaNumericMsg,
  bindConditionalRevalidation,
  conditionalValidator,
  emailMsg,
  getControlErrorMessage,
  maxLengthMsg,
  minDateMsg,
  minLengthMsg,
  notEmptyMsg,
  numericMsg,
  patternMsg,
  requiredMsg,
} from './form-validators';

describe('form-validators', () => {
  it('validates requiredMsg and notEmptyMsg', () => {
    const req = requiredMsg('Required');
    const ne = notEmptyMsg('Not empty');

    expect(req(new FormControl(null))).toEqual({ required: { message: 'Required' } });
    expect(req(new FormControl('   '))).toBeNull();
    expect(ne(new FormControl('   '))).toEqual({ notEmpty: { message: 'Not empty' } });
    expect(ne(new FormControl('abc'))).toBeNull();
  });

  it('validates minLengthMsg and maxLengthMsg including numeric values', () => {
    const min = minLengthMsg(3, 'Too short');
    const max = maxLengthMsg(4, 'Too long');

    expect(min(new FormControl(null))).toBeNull();
    expect(min(new FormControl(12))).toEqual({ minLength: { message: 'Too short' } });
    expect(min(new FormControl(123))).toBeNull();
    expect(max(new FormControl('12345'))).toEqual({ maxLength: { message: 'Too long' } });
    expect(max(new FormControl('1234'))).toBeNull();
  });

  it('validates emailMsg, numericMsg, alphaNumericMsg, and patternMsg', () => {
    const email = emailMsg('Bad email');
    const num = numericMsg('Digits only');
    const alpha = alphaNumericMsg('Alnum only');
    const pat = patternMsg('woodlotFormat', /^W\d{4}$/, 'Bad format');

    expect(email(new FormControl('bad'))).toEqual({ email: { message: 'Bad email' } });
    expect(email(new FormControl('a@b.ca'))).toBeNull();

    expect(num(new FormControl('12a'))).toEqual({ numeric: { message: 'Digits only' } });
    expect(num(new FormControl(1055))).toBeNull();

    expect(alpha(new FormControl('W-12'))).toEqual({ alphaNumeric: { message: 'Alnum only' } });
    expect(alpha(new FormControl('W1234'))).toBeNull();

    expect(pat(new FormControl('W123'))).toEqual({ woodlotFormat: { message: 'Bad format' } });
    expect(pat(new FormControl('W1234'))).toBeNull();
  });

  it('validates minDateMsg against ISO strings and Dates', () => {
    const min = minDateMsg(() => '2026-05-10', 'Too early');

    expect(min(new FormControl(null))).toBeNull();
    expect(min(new FormControl(new Date('2026-05-09T12:00:00Z')))).toEqual({
      minDate: { message: 'Too early' },
    });
    expect(min(new FormControl(new Date('2026-05-10T00:00:00')))).toBeNull();
  });

  it('supports conditionalValidator and bindConditionalRevalidation', () => {
    const fg = new FormGroup({
      enabled: new FormControl(false),
      target: new FormControl(null, [
        conditionalValidator((parent) => parent.get('enabled')?.value === true, requiredMsg('Needed')),
      ]),
    });
    bindConditionalRevalidation(fg, 'enabled', ['target']);

    expect(fg.get('target')?.valid).toBe(true);
    fg.get('enabled')?.setValue(true);
    expect(fg.get('target')?.valid).toBe(false);
    expect(getControlErrorMessage(fg, 'target', 'required')).toBe('Needed');
    expect(getControlErrorMessage(fg, 'target', 'other')).toBeNull();
    expect(getControlErrorMessage(null, 'target', 'required')).toBeNull();
  });
});
