import { NgIf } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { MatError, MatFormField, MatFormFieldModule, MatLabel } from '@angular/material/form-field';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FileInputDirective, FileInputValidators, FileInputValue } from '@ngx-dropzone/cdk';
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
  readonly BYTES_PER_MB = 1048576;
  maxFileSize = 10 * this.BYTES_PER_MB; // bytes - default to max 10mb (set from global config)
  invalidTypeText: string;
  uploadedFile: File;

  validators: any[];
  fileCtrl = new FormControl(null);

  @Output() onFileSelected = new EventEmitter<FileInputValue>();

  constructor() {
    // Deliberately empty
  }

  ngOnInit() {
    this.maxFileSize = this.maxFileSizeMB ? this.maxFileSizeMB * this.BYTES_PER_MB : this.maxFileSize;
    this.validators = [
      FileInputValidators.accept(this.fileTypes.join(',')), 
      FileInputValidators.maxSize(this.maxFileSize)
    ];
    this.fileCtrl.setValidators(this.validators);

    // Watch for changes and emit to parent
    this.fileCtrl.valueChanges.subscribe(value => {
      console.log('File control value changed:', value);
      console.log('File control errors:', this.fileCtrl.errors);
      // this.onFileSelected.emit(value);
      // 
      // You can also emit the file content here if needed, similar to onSelect method.
      // For example, if you want to read the file content and emit it:
      // if (value) {
      //   const file = Array.isArray(value) ? value[0] : value; // Handle multiple files if needed
      //   this.emitFilesContent(file);
      // } else {
      //   this.outputFileContent.emit(null);
      // }
      // this.onFileSelected.emit(value);
    });
  }

  onSelect(event: Event) {
    console.log('File input change event:', event);
    console.log('File controle: ', this.fileCtrl);
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) {
      this.uploadedFile = null;
      this.fileUploaded.emit(null);
      this.outputFileContent.emit(null);
      return;
    }
    const file = files[0];

    if (!this.isAcceptedFileType(file)) {
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

  /**
   * Checks if the file type is accepted.
   * For .msg (email) files, the file.type is often empty, so we also check the file extension.
   */
  private isAcceptedFileType(file: File): boolean {
    const OUTLOOK_MIME = 'application/vnd.ms-outlook';
    const MSG_EXTENSION = 'msg';
    
    const fileType = file.type || '';
    const fileName = file.name || '';
    const extension = fileName.split('.').pop()?.toLowerCase();
    // Accept .msg files if parent accepts application/vnd.ms-outlook
    if (fileType === OUTLOOK_MIME || extension === MSG_EXTENSION) {
      return this.fileTypes.includes(OUTLOOK_MIME);
    }
    // Standard check
    return this.fileTypes.includes(fileType);
  }

  removeFile() {
    this.uploadedFile = null;
    this.fileUploaded.emit(null);
    this.outputFileContent.emit(null);
  }

  get file() {
    return this.fileCtrl.value;
  }
  
  clear() {
    this.fileCtrl.setValue(null);
  }
}
