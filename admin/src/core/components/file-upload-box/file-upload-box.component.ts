import { NgIf } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { MatError, MatFormField, MatFormFieldModule, MatLabel } from '@angular/material/form-field';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FileInputDirective, FileInputValidators } from '@ngx-dropzone/cdk';
import { MatDropzone } from '@ngx-dropzone/material';
@Component({
    standalone: true,
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
        FileInputDirective,
        NgIf],
    selector: 'app-upload-box',
    templateUrl:'./file-upload-box.component.html', 
    styleUrls: ['./file-upload-box.component.scss']
})
export class UploadBoxComponent implements OnInit {
  @Input() maxFileSizeMB: number;
  @Input() fileTypes: string[] = [
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
  ];

  @Output() emitFile = new EventEmitter<File | null>();

  readonly BYTES_PER_MB = 1048576;
  maxFileSize = 10 * this.BYTES_PER_MB; // bytes - default to max 10mb (set from global config)
  invalidTypeText: string;
  uploadedFile: File;

  validators: any[];
  fileCtrl = new FormControl(null);

  constructor() {
    // Deliberately empty
  }

  ngOnInit() {
    this.maxFileSize = this.maxFileSizeMB ? this.maxFileSizeMB * this.BYTES_PER_MB : this.maxFileSize;
    this.validators = [
      FileInputValidators.accept(this.fileTypes.join(',')), // file type validation
      FileInputValidators.maxSize(this.maxFileSize) // file size validation
    ];
    this.fileCtrl.setValidators(this.validators);

    // Watch for changes and emit File/null if valid/invalid
    this.fileCtrl.valueChanges.subscribe(value => {
      const file = this.fileCtrl.valid? value as File : null;
      this.emitFile.emit(file);
    });
  }

  get file() {
    return this.fileCtrl.value;
  }
  
  clear() {
    this.fileCtrl.setValue(null);
  }
}
