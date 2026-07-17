import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

// Migrated from admin
export interface DialogData {
  title: string;
  message: string;
  width?: string;
  height?: string;
  isWarning?: boolean;
  buttons: {
    cancel?: {
      text: string;
    };
    confirm?: {
      text: string;
    };
  };
}

@Component({
  standalone: true,
  imports: [CommonModule, MatDialogModule],
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
    
      @if (data.buttons.confirm) {
        <button [mat-dialog-close]="true"
          class="btn btn-primary confirm"
          type="button">
          {{ data['buttons']['confirm']['text'] | titlecase }}
        </button>
      }
    </mat-dialog-actions>
    `,
  styleUrls: ['./dialog.component.scss'],
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
}
