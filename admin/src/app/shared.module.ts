import { NgModule } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { BrowserModule } from '@angular/platform-browser';

import { NewlinesPipe } from '../core/pipes/newlines.pipe';
import { OrderByPipe } from '../core/pipes/order-by.pipe';
import { PublishedPipe } from '../core/pipes/published.pipe';

import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgxDropzoneModule } from 'ngx-dropzone';
import { ButtonComponent } from '../core/components/button/button.component';
import { DialogComponent } from '../core/components/dialog/dialog.component';
import { FileRowComponent } from '../core/components/file-row/file-row.component';
import { UploadBoxComponent } from '../core/components/file-upload-box/file-upload-box.component';
import { FormGroupComponent } from '../core/components/form-group/form-group.component';
import { AppFormControlDirective } from '../core/directives/form-control.directive';
import { FileUploadComponent } from './file-upload/file-upload.component';

@NgModule({
  imports: [BrowserModule, MatSlideToggleModule, MatSnackBarModule, MatDialogModule, MatProgressBarModule, NgxDropzoneModule, MatIconModule, FontAwesomeModule],//LeafletModule

  declarations: [OrderByPipe, NewlinesPipe, PublishedPipe, FileUploadComponent, DialogComponent, ButtonComponent,
    FileRowComponent, AppFormControlDirective, FormGroupComponent, UploadBoxComponent],

  exports: [
    MatSlideToggleModule,
    MatSnackBarModule,
    MatProgressBarModule,
    OrderByPipe,
    NewlinesPipe,
    PublishedPipe,
    FileUploadComponent,
    DialogComponent,
    AppFormControlDirective,
    ButtonComponent,
    FormGroupComponent,
    FontAwesomeModule,
    FileRowComponent,
    UploadBoxComponent,
  ]
})
export class SharedModule {
}
