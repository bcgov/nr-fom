import { AbstractControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { DateTime } from 'luxon';

function isBlankValue(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

function toDayStart(value: unknown): DateTime | null {
  if (value instanceof Date) {
    const dt = DateTime.fromJSDate(value);
    return dt.isValid ? dt.startOf('day') : null;
  }
  if (typeof value === 'string' && value.length > 0) {
    const dt = DateTime.fromISO(value);
    return dt.isValid ? dt.startOf('day') : null;
  }
  return null;
}

/** Required validator that stores a user-facing message on the `required` error key. */
export function requiredMsg(message = ''): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null =>
    Validators.required(control) ? { required: { message } } : null;
}

/** Rejects null, undefined, or whitespace-only values with a `notEmpty` error key. */
export function notEmptyMsg(message = ''): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: unknown = control.value;
    if (isBlankValue(value) || String(value).trim().length === 0) {
      return { notEmpty: { message } };
    }
    return null;
  };
}

/** Validates stringified minimum length for non-empty values under the `minLength` key. */
export function minLengthMsg(min: number, message = ''): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (isBlankValue(control.value)) {
      return null;
    }
    return String(control.value).length >= min ? null : { minLength: { message } };
  };
}

/** Validates stringified maximum length for non-empty values under the `maxLength` key. */
export function maxLengthMsg(max: number, message = ''): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (isBlankValue(control.value)) {
      return null;
    }
    return String(control.value).length <= max ? null : { maxLength: { message } };
  };
}

/** Email validator storing a message under the `email` key. */
export function emailMsg(message = ''): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null =>
    Validators.email(control) ? { email: { message } } : null;
}

/** Digits-only numeric validator for non-empty values under the `numeric` key. */
export function numericMsg(message = ''): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (isBlankValue(control.value)) {
      return null;
    }
    return /^[0-9]+$/.test(String(control.value)) ? null : { numeric: { message } };
  };
}

/** Alphanumeric validator for non-empty values under the `alphaNumeric` key. */
export function alphaNumericMsg(message = ''): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (isBlankValue(control.value)) {
      return null;
    }
    return /^[a-zA-Z0-9]+$/.test(String(control.value)) ? null : { alphaNumeric: { message } };
  };
}

/** Regex pattern validator storing errors under `errorKey` for non-empty values. */
export function patternMsg(errorKey: string, regex: RegExp, message = ''): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (isBlankValue(control.value)) {
      return null;
    }
    return regex.test(String(control.value)) ? null : { [errorKey]: { message } };
  };
}

/** Validates that a non-empty date is on or after `getMinDate()` (day-precision). */
export function minDateMsg(
  getMinDate: (parent: FormGroup | null) => Date | string | null | undefined,
  message = ''
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valueDay = toDayStart(control.value);
    if (!valueDay) {
      return null;
    }
    const parent = control.parent instanceof FormGroup ? control.parent : null;
    const minDay = toDayStart(getMinDate(parent));
    if (!minDay) {
      return null;
    }
    return valueDay >= minDay ? null : { minDate: { message } };
  };
}

/** Runs `validator` only when `predicate` returns true for the parent `FormGroup`. */
export function conditionalValidator(
  predicate: (parent: FormGroup) => boolean,
  validator: ValidatorFn
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!(control.parent instanceof FormGroup)) {
      return null;
    }
    return predicate(control.parent) ? validator(control) : null;
  };
}

/** Re-runs validation on `targetKeys` whenever `sourceKey` changes. */
export function bindConditionalRevalidation(
  fg: FormGroup,
  sourceKey: string,
  targetKeys: string[]
): void {
  fg.get(sourceKey)?.valueChanges.subscribe(() => {
    for (const key of targetKeys) {
      fg.get(key)?.updateValueAndValidity({ emitEvent: false });
    }
  });
}

/** Extracts the error message for `messageKey` from a control in `fg`. */
export function getControlErrorMessage(
  fg: FormGroup | null | undefined,
  controlName: string,
  messageKey: string | null = null
): string | null {
  const errors = fg?.get(controlName)?.errors;
  if (errors != null && messageKey !== null) {
    const entry = errors[messageKey] as { message?: string } | undefined;
    if (entry?.message) {
      return entry.message;
    }
  }
  return null;
}
