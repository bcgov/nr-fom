import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { DialogComponent, DialogData } from '@public-core/components/dialog/dialog.component';
@Injectable({
  providedIn: 'root',
})
export class ModalService {

  constructor(public dialog: MatDialog) {
  }

  openDialog(config: { data: DialogData; disableClose?: boolean; autoFocus?: boolean }): MatDialogRef<any> {
    const { data, disableClose = false, autoFocus = true } = config;
    const { width = null } = data;
    return this.dialog.open(DialogComponent, {
      data,
      width,
      disableClose,
      autoFocus,
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
