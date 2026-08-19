import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppFormControlDirective } from './form-control.directive';

@Component({
  imports: [ReactiveFormsModule, AppFormControlDirective],
  template: `
    <input id="typed" class="form-control" [formControl]="typed" [appFormControl]="typed" />
    <input
      id="picked"
      class="form-control"
      [formControl]="picked"
      [appFormControl]="picked"
      appFormControlErrorOnDirty
      [appFormControlSubmitted]="submitted()" />
  `,
})
class HostComponent {
  // minLength as well as required, so that "invalid" is still reachable once a value is set.
  readonly typed = new FormControl<string | null>(null, [Validators.required, Validators.minLength(5)]);
  readonly picked = new FormControl<string | null>(null, [Validators.required, Validators.minLength(5)]);
  readonly submitted = signal(false);
}

describe('AppFormControlDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function classesOf(id: string): DOMTokenList {
    return fixture.nativeElement.querySelector(`#${id}`).classList;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should not flag an invalid control before the user has interacted with it', () => {
    expect(classesOf('typed')).not.toContain('is-invalid');
    expect(classesOf('picked')).not.toContain('is-invalid');
  });

  it('should flag a typed field on blur (touched)', () => {
    host.typed.markAsTouched();
    fixture.detectChanges();

    expect(classesOf('typed')).toContain('is-invalid');
    expect(classesOf('typed')).toContain('invalid');
  });

  // The regression this mode exists for: a bsDatepicker popup renders in <body>, so it blurs the
  // input one event before the picked date reaches the control. Reacting to that blur flashed the
  // "required" error on every first pick.
  it('should stay quiet when an error-on-dirty field is only touched', () => {
    host.picked.markAsTouched();
    fixture.detectChanges();

    expect(classesOf('picked')).not.toContain('is-invalid');
    expect(classesOf('picked')).not.toContain('invalid');
  });

  it('should flag an error-on-dirty field once its value changes', () => {
    host.picked.markAsTouched();
    host.picked.markAsDirty();
    host.picked.setValue('abc'); // shorter than minLength, so still invalid
    fixture.detectChanges();

    expect(classesOf('picked')).toContain('is-invalid');
  });

  it('should flag a pristine error-on-dirty field once the form has been submitted', () => {
    host.submitted.set(true);
    fixture.detectChanges();

    expect(host.picked.pristine).toBe(true);
    expect(classesOf('picked')).toContain('is-invalid');
  });

  it('should mark error-on-dirty fields for the stylesheet to opt out of ng-touched borders', () => {
    expect(classesOf('picked')).toContain('error-on-dirty');
    expect(classesOf('typed')).not.toContain('error-on-dirty');
  });

  it('should not flag a disabled control', () => {
    host.typed.markAsTouched();
    host.typed.disable();
    fixture.detectChanges();

    expect(classesOf('typed')).not.toContain('is-invalid');
  });
});
