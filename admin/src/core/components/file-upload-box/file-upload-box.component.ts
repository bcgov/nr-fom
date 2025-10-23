import { NgIf } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormField, MatFormFieldModule, MatLabel } from '@angular/material/form-field';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FileInputValidators, FileInputValue } from '@ngx-dropzone/cdk';
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
export class UploadBoxComponent implements OnInit {
  isImageType( type: string ) {
    const imageTypes = [
      'image/png',
      'image/jpeg',
      'image/tiff',
      'image/x-tiff',
      'image/bmp',
      'image/x-windows-bmp',
      'image/gif',
    ]
    return imageTypes.includes(type)
  }
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
  allowedFileTypes: string; // limit for file types
  maxFileSize = 0; // bytes - default to max 10mb (set from global config)
  invalidTypeText: string;
  fileCtrl: any;
  
  constructor() { 
    // Deliberately empty
  }
  
  ngOnInit(): void {
    /* file size multiplied by 1024 for conversion */
    this.maxFileSize = (this.maxFileSizeMB ? this.maxFileSizeMB : 10) * 1048576;
    this.allowedFileTypes = this.fileTypes.join(', ');
    const validators = [
      FileInputValidators.accept(this.allowedFileTypes),
      FileInputValidators.maxSize(this.maxFileSize)
    ];
    this.fileCtrl = new FormControl<FileInputValue>(null, validators);

    // Watch for validation errors
    this.subscribeToFormStatusChange();

    // Emit files when selected
    this.subscribeToFileSelected();

  }

  private subscribeToFormStatusChange() {
    this.fileCtrl.statusChanges.subscribe(() => {
      const errors = this.fileCtrl.errors;
      if (errors?.accept) {
        this.invalidTypeText = 'The file type is not accepted';
      } else if (errors?.maxSize) {
        this.invalidTypeText = 'The file size cannot exceed ' + this.maxFileSize / 1048576 + ' MB.';
      } else {
        this.invalidTypeText = null;
      }
    });
  }
  
  private subscribeToFileSelected() {
    this.fileCtrl.valueChanges.subscribe((file: File) => {
      if (file) {
        this.fileUploaded.emit(file);
        this.emitFilesContent(file);
      }
    });
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

  get uploadedFile() {
    return this.fileCtrl.value;
  }

  remove() {
    this.fileCtrl.setValue(null);
    this.fileUploaded.emit(null);
  }

}
