import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { OrderByPipe } from '@public-core/pipes/order-by.pipe';
import { NewlinesPipe } from '@public-core/pipes/newlines.pipe';
import { ObjectFilterPipe } from '@public-core/pipes/object-filter.pipe';
import { MatDialogModule } from '@angular/material/dialog';
import { DialogComponent } from '@public-core/components/dialog/dialog.component';

@NgModule({
  imports: [BrowserModule, MatProgressBarModule, MatSnackBarModule, MatDialogModule],
  declarations: [OrderByPipe, NewlinesPipe, ObjectFilterPipe, DialogComponent],
  exports: [
    MatProgressBarModule,
    MatSnackBarModule,
    OrderByPipe,
    NewlinesPipe,
    ObjectFilterPipe,
    DialogComponent
  ]
})
export class SharedModule { }
