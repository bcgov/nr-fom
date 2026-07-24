import { AttachmentTypeEnum } from "@admin-core/models/attachmentTypeEnum";
import { Injectable, inject } from "@angular/core";
import {
    AttachmentResponse,
    AttachmentService,
    WorkflowStateEnum,
} from '@api-client';
import { saveAs } from "file-saver-es";

@Injectable({
  providedIn: 'root'
})
export class AttachmentResolverSvc {
  attachmentService = inject(AttachmentService);


  public async getAttachments(projectId: number): Promise<AttachmentResponse[]> {
      const attachments = await this.attachmentService.attachmentControllerFind(projectId).toPromise();
      return attachments ?? [];
  }

  public async attachmentControllerRemove(attachmentId: number): Promise<any> {
    return this.attachmentService.attachmentControllerRemove(attachmentId).toPromise();
  }

  // Used for (click) event from <a>/<button> at Angular page to download a file.
  public async getFileContents(fileId: number, filename: string): Promise<void> {
    this.attachmentService.attachmentControllerGetFileContents(fileId)
        .subscribe((value: Blob) => {
            const data: Blob = new Blob([value], {
                type: value.type
              });
              // file-saver:saveAs will download the file.
              saveAs(data, filename);
        });
  }

  /**
   * For public notice: only allow deleting when state = Initial.
   * For supporting document: allow deleting when state = Initial, Commenting Open, Commenting Closed.
   */
  public isDeleteAttachmentAllowed(attachmentTypeCode: string, workFlowStateCode: string) {
      return workFlowStateCode === WorkflowStateEnum.Initial ||
            ((workFlowStateCode === WorkflowStateEnum.CommentOpen || workFlowStateCode === WorkflowStateEnum.CommentClosed) && 
            attachmentTypeCode === AttachmentTypeEnum.SUPPORTING_DOC)
  }

}
