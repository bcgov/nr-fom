
export interface DialogData {
  title: string;
  message: string;
  width?: string;
  height?: string;
  maxWidth?: string;
  buttons: {
    cancel?: {
      text: string;
    };
    confirm?: {
      text: string;
    };
  };
}

