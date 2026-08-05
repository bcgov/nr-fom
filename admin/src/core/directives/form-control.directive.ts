import { Directive, HostBinding, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

@Directive({
    selector: '[appFormControl]',
})
export class AppFormControlDirective {
  // Bound as `[appFormControl]="fg.get('x')"`, and `AbstractControl.get()` can return null,
  // so the value is nullable even though the binding is always present.
  readonly appFormControl = input.required<AbstractControl | null>();

  @HostBinding( 'class.is-invalid' )
  get isInvalid() {
    const fc = this.appFormControl();
    return !!fc && fc.touched && fc.invalid;
  }

  @HostBinding( 'class.invalid' )
  get invalid() {
    const fc = this.appFormControl();
    return !!fc && fc.touched && fc.invalid;
  }
}
