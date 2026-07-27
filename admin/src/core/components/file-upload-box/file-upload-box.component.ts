
import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormField, form, validate } from '@angular/forms/signals';
import { MatChipsModule } from '@angular/material/chips';
import { MatError, MatFormField, MatFormFieldModule, MatLabel } from '@angular/material/form-field';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AcceptService, FileInputDirective } from '@ngx-dropzone/cdk';
import { MatDropzone } from '@ngx-dropzone/material';
@Component({
    imports: [
    FormField,
    MatDropzone,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatIconModule,
    MatFormField,
    MatLabel,
    MatIcon,
    MatError,
    FileInputDirective
],
    selector: 'app-upload-box',
    templateUrl:'./file-upload-box.component.html',
    styleUrl: './file-upload-box.component.scss'
})
export class UploadBoxComponent {
  // Reuse the library's own accept-matching (handles MIME + extension + wildcards) instead of a bespoke check.
  private readonly acceptSvc = inject(AcceptService);

  readonly maxFileSizeMB = input<number>();
  readonly fileTypes = input<string[]>([
    'image/png',
    'image/jpeg',
    'image/tiff',
    'image/x-tiff',
    'image/bmp',
    'image/x-windows-bmp',
    'image/gif',
    'text/plain',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
]);

  readonly emitFile = output<File | null>();

  readonly BYTES_PER_MB = 1048576;
  private readonly DEFAULT_MAX_FILE_SIZE = 10 * this.BYTES_PER_MB; // 10mb default (overridable via input)

  /** Max upload size in bytes — from the optional `maxFileSizeMB` input, else the default. */
  readonly maxFileSize = computed(() => {
    const mb = this.maxFileSizeMB();
    return mb ? mb * this.BYTES_PER_MB : this.DEFAULT_MAX_FILE_SIZE;
  });

  /**
   * Signal Forms model: a single optional file. `null` is the legitimate "nothing selected" state —
   * @ngx-dropzone's `FileInputValue` explicitly includes `null`, so `[formField]` binds it directly.
   */
  private readonly fileModel = signal<{ file: File | null }>({ file: null });

  readonly fileForm = form(this.fileModel, (path) => {
    // Two independent validators so both messages can surface at once (mirrors the template's two blocks).
    validate(path.file, ({ value }) => {
      const file = value();
      if (file && !this.acceptSvc.accepts(file, this.fileTypes().join(','))) {
        return { kind: 'accept', message: 'The file type is not accepted.' };
      }
      return undefined;
    });
    validate(path.file, ({ value }) => {
      const file = value();
      if (file && file.size > this.maxFileSize()) {
        return { kind: 'maxSize', message: 'File is too large.' };
      }
      return undefined;
    });
  });

  readonly selectedFile = computed(() => this.fileForm.file().value());
  readonly acceptError = computed(() => this.fileForm.file().errors().some((e) => e.kind === 'accept'));
  readonly maxSizeError = computed(() => this.fileForm.file().errors().some((e) => e.kind === 'maxSize'));

  constructor() {
    // Mirror the old `fileCtrl.valueChanges.subscribe` emit: fire on each actual value change (user
    // select / drop / clear), NOT on init — an init emit(null) would trigger the parent's error dialog.
    // Validity is read untracked so a bare validity flip (e.g. an input-driven size-limit change) does
    // not re-emit, matching the reactive `valueChanges` semantics.
    let firstRun = true;
    effect(() => {
      const file = this.fileForm.file().value();
      if (firstRun) {
        firstRun = false;
        return;
      }
      const valid = untracked(() => this.fileForm.file().valid());
      this.emitFile.emit(valid && file ? file : null);
    });
  }

  get file() {
    return this.fileForm.file().value();
  }

  clear() {
    this.fileModel.set({ file: null });
  }
}
