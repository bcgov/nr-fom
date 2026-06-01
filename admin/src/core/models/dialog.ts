
export interface DialogData {
  title: string;
  message: string;
  width?: string;
  height?: string;
  maxWidth?: string;
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

