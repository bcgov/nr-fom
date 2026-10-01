import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { DateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  IsoDateAdapter,
  provideIsoDateAdapter,
  YearDateDirective,
} from '@utility/dates/iso-date.adapter';

@Component({
  imports: [FormsModule, MatDatepickerModule],
  providers: provideIsoDateAdapter(),
  template: `
    <input id="iso" [matDatepicker]="picker" [(ngModel)]="date" />
    <mat-datepicker #picker />
  `,
})
class IsoHostComponent {
  date: Date | null = new Date(2026, 0, 2);
}

@Component({
  imports: [FormsModule, MatDatepickerModule, YearDateDirective],
  providers: provideIsoDateAdapter(),
  template: `
    <div appYearDate>
      <input id="year" [matDatepicker]="picker" [(ngModel)]="date" />
      <mat-datepicker #picker />
    </div>
  `,
})
class YearHostComponent {
  date: Date | null = new Date(2026, 8, 30);
}

describe('IsoDateAdapter', () => {
  let adapter: IsoDateAdapter;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideIsoDateAdapter() });
    adapter = TestBed.inject(DateAdapter) as IsoDateAdapter;
  });

  it('formats a local calendar day as YYYY-MM-DD', () => {
    expect(adapter.format(new Date(2026, 0, 2), 'yyyy-MM-dd')).toBe('2026-01-02');
  });

  it('formats a year-only input as YYYY', () => {
    expect(adapter.format(new Date(2026, 8, 30), 'yyyy')).toBe('2026');
  });

  it('deserializes a date-only string as that local calendar day', () => {
    const parsed = adapter.deserialize('2026-01-01');
    expect(parsed).not.toBeNull();
    expect(parsed!.getTime()).toBe(new Date(2026, 0, 1).getTime());
    if (new Date('2026-01-01').getTimezoneOffset() !== 0) {
      expect(parsed!.getTime()).not.toBe(new Date('2026-01-01').getTime());
    }
  });

  it('rejects a calendar day that does not exist', () => {
    const parsed = adapter.parse('2026-02-31', 'yyyy-MM-dd');
    expect(parsed).not.toBeNull();
    expect(adapter.isValid(parsed!)).toBe(false);
  });

  it('shows YYYY-MM-DD in a datepicker input', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [IsoHostComponent],
      providers: [provideAnimationsAsync('noop')],
    }).compileComponents();
    const fixture: ComponentFixture<IsoHostComponent> = TestBed.createComponent(IsoHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#iso');
    expect(input.value).toBe('2026-01-02');
  });

  it('shows YYYY when a year directive overrides the ISO format', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [YearHostComponent],
      providers: [provideAnimationsAsync('noop')],
    }).compileComponents();
    const fixture: ComponentFixture<YearHostComponent> = TestBed.createComponent(YearHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#year');
    expect(input.value).toBe('2026');
  });
});
