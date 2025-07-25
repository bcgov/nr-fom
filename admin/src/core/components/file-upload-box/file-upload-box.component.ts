import { NgFor, NgIf } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormField, MatFormFieldModule, MatLabel } from '@angular/material/form-field';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { DropzoneCdkModule, FileInputValidators, FileInputValue } from '@ngx-dropzone/cdk';
import { DropzoneMaterialModule } from '@ngx-dropzone/material';
@Component({
    standalone: true,
    imports: [
        ReactiveFormsModule,
        DropzoneCdkModule, 
        DropzoneMaterialModule, 
        MatFormFieldModule,
        MatInputModule,
        MatChipsModule,
        MatIconModule,
        MatFormField,
        MatLabel,
        MatIcon,
        NgFor, 
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
  @Input() multipleFiles = false;
  @Input() maxFileSizeMB: number;
  @Input() isBlob: boolean = false;
  @Output() fileUploaded = new EventEmitter<File[]>();
  @Output() outputFileContent = new EventEmitter<string | ArrayBuffer | (string | ArrayBuffer)[]>();
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

  @Input() files: File[] = [];

  // limit for file types (set from global config)
  allowedFileTypes: string;
  // bytes - default to max 10mb (set from global config)
  maxFileSize = 0;
  invalidTypeText: string;
  dragMultipleFileMessage: string ='Drag files to upload';
  dragSingleFileMessage: string = 'Drag file to upload';
  filesCtrl: any;
  
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
    this.filesCtrl = new FormControl<FileInputValue>(null, validators);

    // Watch for validation errors
    this.subscribeToFormStatusChange();

    // Emit files when selected
    this.subscribeToFilesSelected();

  }

  private subscribeToFormStatusChange() {
    this.filesCtrl.statusChanges.subscribe(() => {
      const errors = this.filesCtrl.errors;
      if (errors?.accept) {
        this.invalidTypeText = 'The file type is not accepted';
      } else if (errors?.maxSize) {
        this.invalidTypeText = 'The file size cannot exceed ' + this.maxFileSize / 1048576 + ' MB.';
      } else {
        this.invalidTypeText = null;
      }
      if (this.files.length > 1 && !this.multipleFiles){
        this.invalidTypeText = 'Only one document is allowed';
        this.remove(this.filesCtrl.value[0]);
      }
    });
  }
  
  private subscribeToFilesSelected() {
    this.filesCtrl.valueChanges.subscribe((value: File | File[]) => {
      if (value) {
        const files = Array.isArray(value) ? value : [value];
        this.files = files;
        this.fileUploaded.emit(this.files);
        if (files.length > 0) {
          if (this.isBlob) {
            Promise.all(files.map(file => this.readFileContentAsBlobPromise(file)))
              .then(contents => this.outputFileContent.emit(contents));
          } else {
            Promise.all(files.map(file => this.readFileContentPromise(file)))
              .then(contents => this.outputFileContent.emit(contents));
          }
        }
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

  get uploadedFiles() {
    const _files = this.filesCtrl.value;

    if (!_files) return [];
    return Array.isArray(_files) ? _files : [_files];
  }

  remove(file: File) {
    if (Array.isArray(this.filesCtrl.value)) {
      this.filesCtrl.setValue(this.filesCtrl.value.filter((i) => i !== file));
      return;
    }
    this.filesCtrl.setValue(null);
  }

}
