import { TitleCasePipe } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { DialogData } from '@admin-core/models/dialog';
import { ButtonComponent } from '@admin-core/components/button/button.component';

@Component({
    standalone: true,
    selector: 'app-dialog-component',
    template: `
    @if (data['title']) {
      <h2 mat-dialog-title>
        {{ data['title'] }}
      </h2>
    }
    
    <mat-dialog-content [innerHTML]="message"></mat-dialog-content>
    
    <mat-dialog-actions>
    
      @if (data.buttons.cancel) {
        <button mat-dialog-close
          class="btn btn-light cancel"
          type="button">
          {{ data['buttons']['cancel']['text'] | titlecase }}
        </button>
      }
      <!-- <app-button  mat-dialog-close *ngIf="data.buttons.cancel">
      {{ data['buttons']['cancel']['text'] | titlecase }}
    </app-button> -->
    
    @if (data.buttons.confirm) {
      <app-button  [mat-dialog-close]="true">
        {{ data['buttons']['confirm']['text'] | titlecase }}
      </app-button>
    }
    </mat-dialog-actions>
    `,
    styleUrls: ['./dialog.component.scss'],
    imports: [
    MatDialogModule,
    ButtonComponent,
    TitleCasePipe
]
})
export class DialogComponent {
  message = '';

  isWarning = false;

  constructor(public dialogRef: MatDialogRef<DialogComponent>, @Inject(MAT_DIALOG_DATA) public data: DialogData) {
    this.isWarning = data['isWarning'] ? data['isWarning'] : false;
    if (!data['message'].startsWith('<')) {
      this.message = '<p>' + data['message'] + '</p>';
    } else {
      this.message = data['message'];
    }
  }

  clicked(_evt: any) {
    this.dialogRef.close(true);
  }
}
