import { PublicCommentAdminResponse, PublicCommentAdminUpdateRequest, ResponseCodeEnum } from "@api-client";
import { prop, required } from "@rxweb/reactive-form-validators";

const UPDATE_FIELDS = ['responseDetails', 'responseCode'] as const;

export class CommentDetailForm implements Pick<PublicCommentAdminUpdateRequest, typeof UPDATE_FIELDS[number]> {
  @prop()
  responseDetails: string = '';

  @prop()
  @required()
  responseCode: ResponseCodeEnum;

  @prop()
  revisionCount: number;

  constructor(comment: PublicCommentAdminResponse) {
    this.responseCode = comment.response?.code as ResponseCodeEnum;
    this.responseDetails = comment.responseDetails;
    this.revisionCount = comment.revisionCount;
  }

}
