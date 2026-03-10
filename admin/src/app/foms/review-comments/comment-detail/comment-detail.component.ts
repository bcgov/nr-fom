import { StateService } from '@admin-core/services/state.service';
import { Component, Input } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PublicCommentAdminResponse, ResponseCode } from '@api-client';
import { IFormGroup, RxFormBuilder } from '@rxweb/reactive-form-validators';
import { indexBy } from 'remeda';
import { CommentDetailForm } from './comment-detail.form';

import { NewlinesPipe } from '@admin-core/pipes/newlines.pipe';
import { DatePipe, NgFor, NgIf } from '@angular/common';

@Component({
  standalone: true,
  imports: [
    NgIf,
    FormsModule,
    ReactiveFormsModule,
    NgFor,
    DatePipe,
    NewlinesPipe
  ],
  selector: 'app-comment-detail',
  templateUrl: './comment-detail.component.html',
  styleUrls: [ './comment-detail.component.scss' ],
  exportAs: 'commentForm'
})
export class CommentDetailComponent {
    @Input() comments: PublicCommentAdminResponse[] = [];
    @Input() currentCommentIndex: number = 0;

    // Pagination controls
    selectPrevComment() {
      if (this.currentCommentIndex > 0) {
        this.currentCommentIndex--;
        this.emitCommentChange();
      }
    }

    selectNextComment() {
      if (this.currentCommentIndex < this.comments.length - 1) {
        this.currentCommentIndex++;
        this.emitCommentChange();
      }
    }

    selectNextUnactioned() {
      for (let i = this.currentCommentIndex + 1; i < this.comments.length; i++) {
        if (!this.comments[i].response || !this.comments[i].response.code) {
          this.currentCommentIndex = i;
          this.emitCommentChange();
          return;
        }
      }
    }

    isFirstComment(): boolean {
      return this.currentCommentIndex === 0;
    }

    isLastComment(): boolean {
      return this.currentCommentIndex === this.comments.length - 1;
    }

    isLastUnactioned(): boolean {
      for (let i = this.currentCommentIndex + 1; i < this.comments.length; i++) {
        if (!this.comments[i].response || !this.comments[i].response.code) {
          return false;
        }
      }
      return true;
    }

    getCurrentCommentIndex(): number {
      return this.currentCommentIndex;
    }

    getTotalComments(): number {
      return this.comments.length;
    }

    emitCommentChange() {
      // TODO: Emit event to parent to update selected comment
    }

    setResponseCode(code: string) {
      this.commentFormGroup.get('responseCode').setValue(code);
    }
  commentScopeCodes = indexBy(this.stateSvc.getCodeTable('commentScopeCode'), (x) => x.code);
  commentFormGroup: IFormGroup<CommentDetailForm>;
  comment: PublicCommentAdminResponse;
  responseDetailsLimit: number = 4000;

  @Input() responseCodes: ResponseCode[];

  private _canReplyComment = false;
  @Input() set canReplyComment(value: boolean) {
    this._canReplyComment = value;
    if (this.commentFormGroup) {
      value ? this.commentFormGroup.enable() : this.commentFormGroup.disable();
    }
  }
  get canReplyComment(): boolean { return this._canReplyComment; }

  @Input() set selectedComment(comment: PublicCommentAdminResponse) {
    this.comment = comment;
    const commentFormGroup = new CommentDetailForm(comment);
    this.commentFormGroup = this.formBuilder.formGroup(commentFormGroup) as IFormGroup<CommentDetailForm>;
    if (!this._canReplyComment) {
      this.commentFormGroup.disable();
    }
  }

  constructor(private formBuilder: RxFormBuilder, private stateSvc: StateService) {
  }
}
