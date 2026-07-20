import { StateService } from '@admin-core/services/state.service';
import { Component, Input, inject, input } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PublicCommentAdminResponse, ResponseCode } from '@api-client';
import { IFormGroup, RxFormBuilder } from '@rxweb/reactive-form-validators';
import { indexBy } from 'remeda';
import { CommentDetailForm } from './comment-detail.form';

import { NewlinesPipe } from '@admin-core/pipes/newlines.pipe';
import { DatePipe } from '@angular/common';

@Component({
    imports: [
    FormsModule,
    ReactiveFormsModule,
    DatePipe,
    NewlinesPipe
],
    selector: 'app-comment-detail',
    templateUrl: './comment-detail.component.html',
    styleUrl: './comment-detail.component.scss',
    exportAs: 'commentForm'
})
export class CommentDetailComponent {
  private formBuilder = inject(RxFormBuilder);
  private stateSvc = inject(StateService);

  commentScopeCodes = indexBy(this.stateSvc.getCodeTable('commentScopeCode'), (x) => x.code);
  commentFormGroup: IFormGroup<CommentDetailForm>;
  comment: PublicCommentAdminResponse;
  responseDetailsLimit: number = 4000;

  readonly responseCodes = input<ResponseCode[]>(undefined);
  readonly canReplyComment = input<boolean>(undefined);

  @Input() set selectedComment(comment: PublicCommentAdminResponse) {
    this.comment = comment;
    const commentFormGroup = new CommentDetailForm(comment)
    this.commentFormGroup = this.formBuilder.formGroup(commentFormGroup) as IFormGroup<CommentDetailForm>;
    if (!this.canReplyComment()) {
      this.commentFormGroup.disable();
    }
  }
}
