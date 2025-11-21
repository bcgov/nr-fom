import { MAX_FILEUPLOAD_SIZE } from '@admin-core/utils/constants';
import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AttachmentResponse, AttachmentService, InteractionResponse } from '@api-client';
import { IFormGroup, RxFormBuilder } from '@rxweb/reactive-form-validators';
import { ConfigService } from '@utility/services/config.service';
import { InteractionDetailForm, InteractionRequest } from './interaction-detail.form';

import { UploadBoxComponent } from '@admin-core/components/file-upload-box/file-upload-box.component';
import { AttachmentResolverSvc } from '@admin-core/services/AttachmentResolverSvc';
import { DatePipe, NgClass, NgIf } from '@angular/common';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';

@Component({
    standalone: true,
    imports: [
        NgIf, 
        FormsModule, 
        ReactiveFormsModule, 
        NgClass, 
        BsDatepickerModule, 
        DatePipe, 
        UploadBoxComponent
    ],
    selector: 'app-interaction-detail',
    templateUrl: './interaction-detail.component.html',
    styleUrls: ['./interaction-detail.component.scss'],
    exportAs: 'interactionForm'
})
export class InteractionDetailComponent {

  today = new Date();
  maxDate = this.today;
  interaction: InteractionResponse;
  @Input()
  editMode: boolean;
  @Input()
  minDate: Date;

  interactionFormGroup: IFormGroup<InteractionRequest>;
  
  file: File = null; // only 1 attachment for Interaction.
  maxFileSize: number = MAX_FILEUPLOAD_SIZE.DOCUMENT;
  fileContent: any;
 
  supportingFileTypes: string[] = 
  [ 'image/png', 'image/jpeg', 'image/jpg', 'application/pdf', 'image/tiff',
    'application/pdf', 'text/plain', 'text/csv', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/rtf', 'application/vnd.ms-outlook'
  ]
  attachment: AttachmentResponse;
  communicationDetailsLimit: number = 4000;

  constructor(
    private formBuilder: RxFormBuilder,
    private configSvc: ConfigService,
    public attachmentSvc: AttachmentService,
    public attachmentResolverSvc: AttachmentResolverSvc,
    private cdr: ChangeDetectorRef
  ) { }

  @Input() set selectedInteraction(interaction: InteractionResponse) {
    this.interaction = interaction;
    const interactionForm = new InteractionDetailForm(interaction)
    this.interactionFormGroup = this.formBuilder.formGroup(interactionForm)as IFormGroup<InteractionRequest>;
    if (!this.editMode) {
      this.interactionFormGroup.disable();
    }
    this.interaction.attachmentId? this.retrieveAttachment(this.interaction.attachmentId)
                                 : this.attachment = null;
    // Force change detection to ensure child components render
    this.cdr.detectChanges();
  }
  
  addNewFile(newFile: File) {
    this.file = newFile;
    if (!this.file) {
      this.interactionFormGroup.get('filename').setValue(null);
    }
    else {
      this.interactionFormGroup.get('filename').setValue(this.file .name);
    }
  }

  getFileContent(fileContent: any) {
    this.fileContent = fileContent;
    // Convert to proper Blob type for adding attachment to FormData.
    const fileContentAsBlob = new Blob([this.fileContent], {type: this.file.type});
    this.interactionFormGroup.get('fileContent').setValue(fileContentAsBlob);
  }

  private async retrieveAttachment(attachmentId: number) {
    this.attachment = await this.attachmentSvc
                      .attachmentControllerFindOne(attachmentId).toPromise();
  }

  isValid(controlName: string): boolean {
    return this.interactionFormGroup.controls[controlName]?.errors == null;
  }

}


