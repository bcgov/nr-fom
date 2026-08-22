import { Directive, ElementRef, HostListener, inject, input } from '@angular/core';
import { NgControl } from '@angular/forms';

@Directive({
  selector: 'input[appDigitsOnly]',
})
export class DigitsOnlyDirective {
  private el = inject(ElementRef<HTMLInputElement>);
  private ngControl = inject(NgControl, { optional: true });

  readonly appDigitsOnly = input<number | undefined, unknown>(undefined, {
    transform: (v: unknown) => {
      if (v === '' || v === undefined || v === null) return undefined;
      const num = typeof v === 'number' ? v : parseInt(String(v), 10);
      return isNaN(num) ? undefined : num;
    },
  });

  readonly maxLength = input<number, unknown>(9, {
    transform: (v: unknown) => {
      if (v === '' || v === undefined || v === null) return 9;
      const num = typeof v === 'number' ? v : parseInt(String(v), 10);
      return isNaN(num) ? 9 : num;
    },
  });

  private getMaxLen(): number {
    const custom = this.appDigitsOnly();
    if (custom !== undefined && typeof custom === 'number' && !isNaN(custom) && custom > 0) {
      return custom;
    }
    const max = this.maxLength();
    if (typeof max === 'number' && !isNaN(max) && max > 0) {
      return max;
    }
    return 9;
  }

  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const inputEl = this.el.nativeElement;
    const maxLen = this.getMaxLen();
    let sanitized = inputEl.value.replace(/\D/g, '').replace(/^0+/, '');
    if (maxLen && sanitized.length > maxLen) {
      sanitized = sanitized.slice(0, maxLen);
    }
    if (inputEl.value !== sanitized) {
      inputEl.value = sanitized;
    }
    if (this.ngControl?.control && this.ngControl.control.value !== (sanitized || null)) {
      this.ngControl.control.setValue(sanitized ? sanitized : null);
    }
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const allowedKeys = [
      'Backspace',
      'Tab',
      'End',
      'Home',
      'ArrowLeft',
      'ArrowRight',
      'Delete',
      'Enter',
    ];

    if (
      allowedKeys.includes(event.key) ||
      (event.key === 'a' && (event.ctrlKey || event.metaKey)) ||
      (event.key === 'c' && (event.ctrlKey || event.metaKey)) ||
      (event.key === 'v' && (event.ctrlKey || event.metaKey)) ||
      (event.key === 'x' && (event.ctrlKey || event.metaKey))
    ) {
      return;
    }

    // Reject non-digit characters
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
      return;
    }

    const inputEl = this.el.nativeElement;
    const maxLen = this.getMaxLen();
    const hasSelection = (inputEl.selectionEnd ?? 0) - (inputEl.selectionStart ?? 0) > 0;
    const digitsOnlyVal = inputEl.value.replace(/\D/g, '').replace(/^0+/, '');

    // Prevent typing '0' as the first character (leading zero)
    if (event.key === '0' && digitsOnlyVal.length === 0 && !hasSelection) {
      event.preventDefault();
      return;
    }

    if (digitsOnlyVal.length >= maxLen && !hasSelection) {
      event.preventDefault();
    }
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedText =
      event.clipboardData?.getData('text') ||
      event.clipboardData?.getData('text/plain') ||
      '';
    const maxLen = this.getMaxLen();
    const sanitized = pastedText.replace(/\D/g, '').replace(/^0+/, '').slice(0, maxLen);

    const inputEl = this.el.nativeElement;
    inputEl.value = sanitized;
    if (this.ngControl?.control) {
      this.ngControl.control.setValue(sanitized ? sanitized : null);
    } else {
      inputEl.dispatchEvent(new Event('input'));
    }
  }
}
