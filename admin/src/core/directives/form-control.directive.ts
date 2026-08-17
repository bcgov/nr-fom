import { booleanAttribute, Directive, HostBinding, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

@Directive({
    selector: '[appFormControl]',
})
export class AppFormControlDirective {
  // Bound as `[appFormControl]="fg.get('x')"`, and `AbstractControl.get()` can return null,
  // so the value is nullable even though the binding is always present.
  readonly appFormControl = input.required<AbstractControl | null>();

  /**
   * Opt-in for readonly inputs whose value can only come from a picker popup (bsDatepicker).
   * The popup is rendered in <body>, so clicking a date blurs the input on mousedown - one event
   * *before* the picked value reaches the control. With the default `touched` trigger that briefly
   * marks an empty required field as invalid, flashing the error message and red border away again
   * as soon as the date lands. Such fields cannot be typed into, so a value change (dirty) is the
   * only meaningful "the user has had their chance" signal; blur says nothing about them.
   */
  readonly appFormControlErrorOnDirty = input(false, { transform: booleanAttribute });

  /**
   * Bind to the form's "submit/save clicked" flag so fields the user never changed still light up
   * when validation blocks the submit. Only needed alongside `appFormControlErrorOnDirty`, which
   * otherwise stays quiet for a pristine field.
   */
  readonly appFormControlSubmitted = input(false, { transform: booleanAttribute });

  @HostBinding( 'class.is-invalid' )
  get isInvalid() {
    return this.showInvalid;
  }

  @HostBinding( 'class.invalid' )
  get invalid() {
    return this.showInvalid;
  }

  /**
   * Marker class for the global `.form-control.ng-touched.ng-invalid` border rule to opt out of,
   * see assets/styles/components/form-elements.scss - Angular's own `ng-touched` class would
   * otherwise re-introduce the flash that `appFormControlErrorOnDirty` exists to prevent.
   */
  @HostBinding( 'class.error-on-dirty' )
  get errorOnDirty() {
    return this.appFormControlErrorOnDirty();
  }

  private get showInvalid(): boolean {
    const fc = this.appFormControl();
    // `invalid` (not `!valid`): a disabled control is neither, and must not be styled as an error.
    if (!fc || !fc.invalid) {
      return false;
    }
    if (this.appFormControlSubmitted()) {
      return true;
    }
    return this.appFormControlErrorOnDirty() ? fc.dirty : fc.touched;
  }
}
