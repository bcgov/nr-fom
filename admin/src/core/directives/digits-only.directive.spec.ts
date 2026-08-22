import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DigitsOnlyDirective } from './digits-only.directive';

@Component({
  imports: [DigitsOnlyDirective, FormsModule, ReactiveFormsModule],
  template: `
    <input
      type="text"
      appDigitsOnly
      [formControl]="control"
    />
  `,
})
class TestHostComponent {
  control = new FormControl<string | null>(null);
}

describe('DigitsOnlyDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let inputEl: HTMLInputElement;
  let component: TestHostComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestHostComponent],
    });
    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    inputEl = fixture.nativeElement.querySelector('input');
  });

  it('allows navigation and control keys', () => {
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true });
    inputEl.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('prevents non-digit characters on keydown', () => {
    const event = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
    inputEl.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    const minusEvent = new KeyboardEvent('keydown', { key: '-', cancelable: true });
    inputEl.dispatchEvent(minusEvent);
    expect(minusEvent.defaultPrevented).toBe(true);
  });

  it('prevents typing 0 as the initial character', () => {
    inputEl.value = '';
    const event = new KeyboardEvent('keydown', { key: '0', cancelable: true });
    inputEl.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('prevents typing beyond max length (default 9 digits)', () => {
    inputEl.value = '123456789';
    const event = new KeyboardEvent('keydown', { key: '5', cancelable: true });
    inputEl.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('sanitizes input on input event by stripping non-digits and leading zeros', () => {
    inputEl.value = '00123abc45';
    inputEl.dispatchEvent(new Event('input'));
    expect(inputEl.value).toBe('12345');
    expect(component.control.value).toBe('12345');
  });

  it('truncates input to 9 digits on input event', () => {
    inputEl.value = '123456789012345';
    inputEl.dispatchEvent(new Event('input'));
    expect(inputEl.value).toBe('123456789');
    expect(component.control.value).toBe('123456789');
  });

  it('sanitizes pasted text on paste event', () => {
    const pasteEvent = new Event('paste', {
      cancelable: true,
    }) as any;
    pasteEvent.clipboardData = {
      getData: (type: string) => (type === 'text' ? '0009876543219999' : ''),
    };
    inputEl.dispatchEvent(pasteEvent);

    expect(pasteEvent.defaultPrevented).toBe(true);
    expect(inputEl.value).toBe('987654321');
    expect(component.control.value).toBe('987654321');
  });

  it('merges pasted text at selection position', () => {
    inputEl.value = '1256';
    inputEl.setSelectionRange(2, 2);

    const pasteEvent = new Event('paste', {
      cancelable: true,
    }) as any;
    pasteEvent.clipboardData = {
      getData: (type: string) => (type === 'text' ? '34' : ''),
    };
    inputEl.dispatchEvent(pasteEvent);

    expect(inputEl.value).toBe('123456');
    expect(component.control.value).toBe('123456');
  });
});
