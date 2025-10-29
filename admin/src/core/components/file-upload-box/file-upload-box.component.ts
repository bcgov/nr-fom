import { NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormField, MatFormFieldModule, MatLabel } from '@angular/material/form-field';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
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
        NgIf],
    selector: 'app-upload-box',
    templateUrl:'./file-upload-box.component.html', 
    styleUrls: ['./file-upload-box.component.scss']
})
export class UploadBoxComponent {
  @Input() maxFileSizeMB: number;
  @Input() isBlob: boolean = false;
  @Output() fileUploaded = new EventEmitter<File>(); // File descriptor/meta information.
  @Output() outputFileContent = new EventEmitter<string | ArrayBuffer>(); // File content
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
  maxFileSize = 0; // bytes - default to max 10mb (set from global config)
  invalidTypeText: string;
  uploadedFile: File;
  filesCtrl = new FormControl<File[]>([]);
  
  constructor() {
    // Deliberately empty
  }

  onSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) {
      this.uploadedFile = null;
      this.fileUploaded.emit(null);
      this.outputFileContent.emit(null);
      return;
    }
    const file = files[0];
    // Validate file type
    if (!this.fileTypes.includes(file.type)) {
      this.invalidTypeText = 'The file type is not accepted';
      this.uploadedFile = null;
      this.fileUploaded.emit(null);
      this.outputFileContent.emit(null);
      return;
    }
    // Validate file size
    this.maxFileSize = (this.maxFileSizeMB ? this.maxFileSizeMB : 10) * 1048576;
    if (file.size > this.maxFileSize) {
      this.invalidTypeText = 'The file size cannot exceed ' + this.maxFileSize / 1048576 + ' MB.';
      this.uploadedFile = null;
      this.fileUploaded.emit(null);
      this.outputFileContent.emit(null);
      return;
    }
    this.invalidTypeText = null;
    this.uploadedFile = file;
    this.fileUploaded.emit(file);
    this.emitFilesContent(file);
  }

  private readFileContentPromise(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result.toString());
      reader.readAsText(file);
    });
  }

  private readFileContentAsBlobPromise(file: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result as ArrayBuffer);
      reader.readAsArrayBuffer(file);
    });
  }

  private emitFilesContent(file: File) {
    if (file) {
      if (this.isBlob) {
        this.readFileContentAsBlobPromise(file)
          .then(contents => this.outputFileContent.emit(contents));
      } else {
        this.readFileContentPromise(file)
          .then(contents => this.outputFileContent.emit(contents));
      }
    } else {
      this.outputFileContent.emit(null);
    }
  }

  remove() {
    this.uploadedFile = null;
    this.fileUploaded.emit(null);
    this.outputFileContent.emit(null);
  }
  
}
