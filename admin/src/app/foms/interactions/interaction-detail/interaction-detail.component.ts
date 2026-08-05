import { MAX_FILEUPLOAD_SIZE } from '@admin-core/utils/constants';
import { Component, Input, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AttachmentResponse, AttachmentService, InteractionResponse } from '@api-client';
import { IFormGroup, RxFormBuilder } from '@rxweb/reactive-form-validators';
import { ConfigService } from '@utility/services/config.service';
import { InteractionDetailForm, InteractionRequest } from './interaction-detail.form';

import { UploadBoxComponent } from '@admin-core/components/file-upload-box/file-upload-box.component';
import { AttachmentResolverSvc } from '@admin-core/services/AttachmentResolverSvc';
import { DatePipe } from '@angular/common';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';

@Component({
    imports: [
    FormsModule,
    ReactiveFormsModule,
    BsDatepickerModule,
    DatePipe,
    UploadBoxComponent
],
    selector: 'app-interaction-detail',
    templateUrl: './interaction-detail.component.html',
    styleUrl: './interaction-detail.component.scss',
    exportAs: 'interactionForm'
})
export class InteractionDetailComponent {
  private formBuilder = inject(RxFormBuilder);
  private configSvc = inject(ConfigService);
  attachmentSvc = inject(AttachmentService);
  attachmentResolverSvc = inject(AttachmentResolverSvc);

  today = new Date();
  maxDate = this.today;
  // Signalized so writes (setter, async attachment fetch, clear) schedule zoneless change detection
  // on their own — replaces the former cdr.detectChanges() calls.
  readonly interaction = signal<InteractionResponse | null>(null);
  @Input()
  editMode: boolean;
  @Input()
  minDate: Date;

  interactionFormGroup: IFormGroup<InteractionRequest>;
  
  file: File | null = null; // only 1 attachment for Interaction.
  maxFileSize: number = MAX_FILEUPLOAD_SIZE.DOCUMENT;
 
  // Note - browser often fails to recognize 'application/vnd.ms-outlook'; for .msg files use '.msg' instead.
  supportingFileTypes: string[] = 
  [ 'image/png', 'image/jpeg', 'image/jpg', 'application/pdf', 'image/tiff',
    'text/plain', 'text/csv', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/rtf', '.msg'
  ]
  readonly attachment = signal<AttachmentResponse | null>(null);
  communicationDetailsLimit: number = 4000;

  @Input() set selectedInteraction(interaction: InteractionResponse) {
    this.interaction.set(interaction);
    const interactionForm = new InteractionDetailForm(interaction)
    this.interactionFormGroup = this.formBuilder.formGroup(interactionForm)as IFormGroup<InteractionRequest>;
    if (!this.editMode) {
      this.interactionFormGroup.disable();
    }
    interaction.attachmentId ? this.retrieveAttachment(interaction.attachmentId)
                             : this.attachment.set(null);
  }

  /** Reset the panel to its empty ("No engagement selected") state. */
  clear() {
    this.interaction.set(null);
    this.attachment.set(null);
  }

  onFileEmit(newFile: File | null) {
    this.file = newFile;
    if (!this.file) {
      this.interactionFormGroup.get('filename')?.setValue(null);
    }
    else {
      this.interactionFormGroup.get('filename')?.setValue(this.file .name);
    }
    this.interactionFormGroup.get('fileContent')?.setValue(this.file);
  }

  private async retrieveAttachment(attachmentId: number) {
    this.attachment.set(await this.attachmentSvc
                      .attachmentControllerFindOne(attachmentId).toPromise() ?? null);
  }

  isValid(controlName: string): boolean {
    return this.interactionFormGroup.get(controlName)?.errors == null;
  }

}


