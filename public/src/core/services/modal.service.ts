import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { DialogComponent, DialogData } from '@public-core/components/dialog/dialog.component';
export const dialogTypes = ['cancel'] as const;

@Injectable({
  providedIn: 'root',
})
export class ModalService {

  constructor(public dialog: MatDialog) {
  }

  openDialog(config: { data: DialogData }): MatDialogRef<any> {
    const { data } = config;
    const { width = null } = data;
    return this.dialog.open(DialogComponent, {
      data,
      width,
    });
  }

  showFOMinitFailure() {
    this.openDialog({ data: {
      message: `Please try again later.`,
      title: `Error: FOM initialization failed.`,
      buttons: { cancel: { text: 'OK' } },
    }});
  }

}
