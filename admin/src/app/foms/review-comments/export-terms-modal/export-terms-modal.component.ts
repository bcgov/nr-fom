import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

interface TermsSection {
  icon: string;
  title: string;
  description: string;
}

interface TermsContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  sections: TermsSection[];
  contactLabel: string;
  contactEmail: string;
}

const TERMS_CONTENT: TermsContent = {
  eyebrow: 'Before you download',
  title: 'Terms of use',
  subtitle: 'Public comments exported from the Forest Operations Map (FOM) portal',
  sections: [
    {
      icon: 'info',
      title: 'Informational use only',
      description: 'Comments in this export file were submitted through the Forest Operations Map (FOM) portal and are reproduced as submitted for convenience and informational purposes. This export is an informational extract only and may not include all associated context, metadata, attachments, subsequent corrections, or withdrawals.',
    },
    {
      icon: 'groups',
      title: 'Restricted sharing',
      description: 'This export is not to be shared with any person who does not have access to the original record in the FOM Software. It is not an official record and the agency responsible does not verify or endorse the accuracy, completeness, or reliability of any comments contained within. The authoritative source record is the original submission maintained in the FOM portal.',
    },
    {
      icon: 'security',
      title: 'Privacy obligations (FOIPPA)',
      description: 'Any collection, use, disclosure, severing, retention, and protection of personal information must be carried out in accordance with the Freedom of Information and Protection of Privacy Act (British Columbia). Disclosure of this export remains subject to FOIPPA and any other applicable legal requirements.',
    },
    {
      icon: 'warning_amber',
      title: 'Your responsibility',
      description: 'Users are responsible for assessing the suitability and applicability of information in this file format.',
    },
  ],
  contactLabel: 'Questions about access to records or privacy should be directed to',
  contactEmail: 'FOI.Requests@gov.bc.ca',
};

@Component({
  standalone: true,
  selector: 'app-export-terms-modal',
  templateUrl: './export-terms-modal.component.html',
  styleUrls: ['./export-terms-modal.component.scss'],
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
})
export class ExportTermsModalComponent {
  readonly termsContent = TERMS_CONTENT;

  constructor(
    private dialogRef: MatDialogRef<ExportTermsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: unknown
  ) {}

  onAgree(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}