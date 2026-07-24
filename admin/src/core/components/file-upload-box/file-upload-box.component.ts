
import { ChangeDetectorRef, Component, OnInit, inject, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { MatError, MatFormField, MatFormFieldModule, MatLabel } from '@angular/material/form-field';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FileInputDirective, FileInputValidators } from '@ngx-dropzone/cdk';
import { MatDropzone } from '@ngx-dropzone/material';
@Component({
    imports: [
    ReactiveFormsModule,
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
export class UploadBoxComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);
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
  maxFileSize = 10 * this.BYTES_PER_MB; // bytes - default to max 10mb (set from global config)
  invalidTypeText: string;
  uploadedFile: File;

  validators: any[];
  fileCtrl = new FormControl<File | null>(null);

  constructor() {
    // Deliberately empty
  }

  ngOnInit() {
    const maxFileSizeMB = this.maxFileSizeMB();
    this.maxFileSize = maxFileSizeMB ? maxFileSizeMB * this.BYTES_PER_MB : this.maxFileSize;
    this.validators = [
      FileInputValidators.accept(this.fileTypes().join(',')), // file type validation
      FileInputValidators.maxSize(this.maxFileSize) // file size validation
    ];
    this.fileCtrl.setValidators(this.validators);

    // Watch for changes and emit File/null if valid/invalid
    this.fileCtrl.valueChanges.subscribe(value => {
      const file = this.fileCtrl.valid? value as File : null;
      this.emitFile.emit(file);
      // Zoneless: the template reads fileCtrl.value/hasError() directly; mark for check so the
      // selected-file name and validation messages update when the control changes (via the
      // @ngx-dropzone fileInput directive, which is outside Angular's own event bindings).
      this.cdr.markForCheck();
    });
  }

  get file() {
    return this.fileCtrl.value;
  }
  
  clear() {
    this.fileCtrl.setValue(null);
  }
}
