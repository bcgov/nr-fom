import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
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
  imports: [CommonModule, MatDialogModule],
  selector: 'app-dialog-component',
  template: `
    @if (data['title']) {
      <h2 mat-dialog-title>
        {{ data['title'] }}
      </h2>
    }
    
    <mat-dialog-content [innerHTML]="message" />
    
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
  styleUrl: './dialog.component.scss',
})
export class DialogComponent {
  dialogRef = inject<MatDialogRef<DialogComponent>>(MatDialogRef);
  data = inject<DialogData>(MAT_DIALOG_DATA);

  message = '';

  isWarning = false;

  constructor() {
    const data = this.data;

    this.isWarning = data['isWarning'] ? data['isWarning'] : false;
    if (!data['message'].startsWith('<')) {
      this.message = '<p>' + data['message'] + '</p>';
    } else {
      this.message = data['message'];
    }
  }
}
