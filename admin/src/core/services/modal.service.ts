import { Injectable, Type, inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { DialogData } from '@admin-core/models/dialog';
import { DialogComponent } from '@admin-core/components/dialog/dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface DialogOptions {
  width?: string;
  height?: string;
  maxWidth?: string;
  panelClass?: string | string[];
  autoFocus?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  dialog = inject(MatDialog);
  snackBar = inject(MatSnackBar);


  modalOpen = false;
  dialogRefClose$: Observable<MatDialogRef<any>>;

  openSnackBar( { message, button }: { message: string, button?: string; } ) {
    return this.snackBar.open( message, button ?? button, { verticalPosition: 'top', panelClass: 'snackbar'} )
  }

  openDialog(config: { data: DialogData }): MatDialogRef<any> {
    const { data } = config;
    const { width = undefined, height = undefined, maxWidth } = data;
    return this.dialog.open(DialogComponent, {
      data,
      width,
      height,
      maxWidth,
    });
  }

  openErrorDialog(message?: string, title: string = 'Error') {
    this.openDialog({
      data: {
        message: message || 'There was an error with the request, please try again.',
        title: title,
        // Increase size due to possibility of larger error messages.
        width: '500px',
        height: '300px',
        buttons: {confirm: {text: 'OK'}}
      }
    });
  }

  openWarningDialog(message: string) {
    this.openDialog({
      data: {
        message: message,
        title: 'Warning',
        width: '340px',
        height: '200px',
        buttons: {confirm: {text: 'OK'}}
      }
    });
  }

  openConfirmationDialog(
    message: string,
    title: string,
    options?: {
      width?: string;
      height?: string;
      maxWidth?: string;
      // Button labels are rendered verbatim.
      confirmText?: string;
      cancelText?: string;
    }
  ): MatDialogRef<any> {
    return this.openDialog({
      data: {
        message: message,
        title: title,
        width: options?.width ?? '460px',
        height: options?.height,
        maxWidth: options?.maxWidth,
        buttons: {
          confirm: {text: options?.confirmText ?? 'OK'},
          cancel: {text: options?.cancelText ?? 'Cancel'}
        }
      }
    });
  }

  openComponentDialog<T>(
    component: Type<T>,
    data: any,
    options?: DialogOptions
  ): MatDialogRef<T> {
    const { width, height, maxWidth, panelClass, autoFocus } = options ?? {};
    return this.dialog.open(component, {
      data,
      width,
      height,
      maxWidth,
      panelClass,
      autoFocus,
    });
  }

  updateDialogRefSubject(ref: MatDialogRef<any>): void {
    this.dialogRefClose$ = ref.afterClosed();
  }
}
