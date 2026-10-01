import { Directive, Injectable, Provider } from '@angular/core';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_NATIVE_DATE_FORMATS,
  MatDateFormats,
  NativeDateAdapter,
} from '@angular/material/core';

/** Input format token. NativeDateAdapter would otherwise render a locale date. */
const ISO_DATE_INPUT = 'yyyy-MM-dd';
const YEAR_DATE_INPUT = 'yyyy';
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const ISO_DATE_FORMATS: MatDateFormats = {
  ...MAT_NATIVE_DATE_FORMATS,
  parse: { ...MAT_NATIVE_DATE_FORMATS.parse, dateInput: ISO_DATE_INPUT },
  display: { ...MAT_NATIVE_DATE_FORMATS.display, dateInput: ISO_DATE_INPUT },
};

export const YEAR_DATE_FORMATS: MatDateFormats = {
  ...MAT_NATIVE_DATE_FORMATS,
  parse: { ...MAT_NATIVE_DATE_FORMATS.parse, dateInput: YEAR_DATE_INPUT },
  display: { ...MAT_NATIVE_DATE_FORMATS.display, dateInput: YEAR_DATE_INPUT },
};

/**
 * Date-only values stay on the local calendar day.
 * `new Date('YYYY-MM-DD')` is UTC midnight and shifts the day in timezones behind UTC.
 */
function parseLocalIso(value: string): Date | null {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day);
  if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatLocalIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

@Injectable()
export class IsoDateAdapter extends NativeDateAdapter {
  override format(date: Date, displayFormat: Object): string {
    if (!this.isValid(date)) {
      throw new Error('IsoDateAdapter: Cannot format invalid date.');
    }
    // dateInput is a string token; calendar labels stay Intl option objects.
    const formatKey: unknown = displayFormat;
    if (formatKey === ISO_DATE_INPUT) {
      return formatLocalIso(date);
    }
    if (formatKey === YEAR_DATE_INPUT) {
      return String(date.getFullYear());
    }
    return super.format(date, displayFormat);
  }

  override parse(value: unknown, parseFormat?: unknown): Date | null {
    if (typeof value !== 'string') {
      return super.parse(value, parseFormat);
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    if (parseFormat === ISO_DATE_INPUT || ISO_DATE_PATTERN.test(trimmed)) {
      return parseLocalIso(trimmed) ?? this.invalid();
    }
    if (parseFormat === YEAR_DATE_INPUT || /^\d{4}$/.test(trimmed)) {
      const year = Number(trimmed);
      return Number.isInteger(year) ? new Date(year, 0, 1) : this.invalid();
    }
    return super.parse(value, parseFormat);
  }

  override deserialize(value: unknown): Date | null {
    if (typeof value === 'string' && ISO_DATE_PATTERN.test(value)) {
      return parseLocalIso(value) ?? this.invalid();
    }
    return super.deserialize(value);
  }
}

export function provideIsoDateAdapter(): Provider[] {
  return [
    { provide: DateAdapter, useClass: IsoDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: ISO_DATE_FORMATS },
  ];
}

export function provideYearDateAdapter(): Provider[] {
  return [
    { provide: DateAdapter, useClass: IsoDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: YEAR_DATE_FORMATS },
  ];
}

/** Year-only inputs (operation start/end). Overrides the ISO adapter on descendant pickers. */
@Directive({
  selector: '[appYearDate]',
  providers: provideYearDateAdapter(),
})
export class YearDateDirective {}
