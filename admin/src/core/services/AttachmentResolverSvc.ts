import { AttachmentTypeEnum } from "@admin-core/models/attachmentTypeEnum";
import { Injectable } from "@angular/core";
import {
    AttachmentResponse,
    AttachmentService,
    WorkflowStateEnum,
} from '@api-client';
import { saveAs } from "file-saver";

@Injectable({
  providedIn: 'root'
})
export class AttachmentResolverSvc {

  constructor(
    public attachmentService: AttachmentService
  ) {  }

  public async getAttachments(projectId: number): Promise<AttachmentResponse[]> {
      return this.attachmentService.attachmentControllerFind(projectId).toPromise()
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
