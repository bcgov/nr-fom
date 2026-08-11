import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { DialogData } from '@admin-core/models/dialog';

@Component({
    selector: 'app-dialog-component',
    template: `
    @if (data['title']) {
      <!-- One line on purpose: Material puts an inline-block ::before on the title,
           so an indented newline here renders as a leading space and knocks the
           title out of alignment with the message below. -->
      <h2 mat-dialog-title>{{ data['title'] }}</h2>
    }
    
    <mat-dialog-content [innerHTML]="message" />
    
    <mat-dialog-actions>
    
      @if (data.buttons.cancel) {
        <button mat-dialog-close
          class="btn btn-light cancel"
          type="button">
          {{ data['buttons']['cancel']['text'] }}
        </button>
      }
    
      @if (data.buttons.confirm) {
        <button [mat-dialog-close]="true"
          class="btn btn-primary confirm"
          type="button">
          {{ data['buttons']['confirm']['text'] }}
        </button>
      }
    </mat-dialog-actions>
    `,
    styleUrl: './dialog.component.scss',
    imports: [MatDialogModule]
})
export class DialogComponent {
  data = inject<DialogData>(MAT_DIALOG_DATA);

  message = '';

  constructor() {
    const data = this.data;

    if (!data['message'].startsWith('<')) {
      this.message = '<p>' + data['message'] + '</p>';
    } else {
      this.message = data['message'];
    }
  }
}
