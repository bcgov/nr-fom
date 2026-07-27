import { StateService } from '@admin-core/services/state.service';
import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { PublicCommentAdminResponse, PublicCommentAdminUpdateRequest, ResponseCode, ResponseCodeEnum } from '@api-client';
import { FormField, disabled, form, maxLength, required } from '@angular/forms/signals';

import { NewlinesPipe } from '@admin-core/pipes/newlines.pipe';
import { DatePipe } from '@angular/common';
import { indexBy } from 'remeda';

@Component({
    imports: [
    FormField,
    DatePipe,
    NewlinesPipe
],
    selector: 'app-comment-detail',
    templateUrl: './comment-detail.component.html',
    styleUrl: './comment-detail.component.scss',
    exportAs: 'commentForm'
})
export class CommentDetailComponent {
  private stateSvc = inject(StateService);

  commentScopeCodes = indexBy(this.stateSvc.getCodeTable('commentScopeCode'), (x) => x.code);
  responseDetailsLimit = 4000;

  readonly selectedComment = input.required<PublicCommentAdminResponse>();
  readonly responseCodes = input<ResponseCode[]>();
  readonly canReplyComment = input<boolean>();

  /**
   * Signal Forms model, reseeded whenever a different comment is selected. `responseCode` uses `''`
   * for the unselected state ('' is invalid for `required`, so a real code must be picked to save).
   * The field shape matches `PublicCommentAdminUpdateRequest` 1:1 (see the `value` getter).
   */
  private readonly model = linkedSignal(() => {
    const comment = this.selectedComment();
    return {
      responseDetails: comment.responseDetails ?? '',
      responseCode: (comment.response?.code as ResponseCodeEnum) ?? '',
      revisionCount: comment.revisionCount,
    };
  });

  readonly commentForm = form(this.model, (path) => {
    required(path.responseCode, { message: 'Select a response' });
    // Replaces the old native `maxlength` attribute (the `[formField]` directive forbids it): the
    // limit is now enforced as a validator instead of a hard keystroke cap. See remainingChars().
    maxLength(path.responseDetails, this.responseDetailsLimit, { message: `Maximum length is ${this.responseDetailsLimit}` });
    disabled(path.responseCode, { when: () => !this.canReplyComment() });
    disabled(path.responseDetails, { when: () => !this.canReplyComment() });
  });

  /** The currently selected comment (kept as a getter so the parent template ref reads it unchanged). */
  get comment(): PublicCommentAdminResponse {
    return this.selectedComment();
  }

  /** The update payload the parent's save button consumes (replaces the old `commentFormGroup.value`). */
  get value(): PublicCommentAdminUpdateRequest {
    const { responseDetails, responseCode, revisionCount } = this.model();
    return { responseDetails, responseCode: responseCode as ResponseCodeEnum, revisionCount };
  }

  readonly remainingChars = computed(() => this.responseDetailsLimit - this.commentForm.responseDetails().value().length);

  /**
   * True when the response text exceeds the DB-enforced limit. Length-based (not the `maxLength`
   * validator) so it holds even while the field is disabled, and drives both the inline error and
   * the parent's save guard — the column cannot store an over-limit value.
   */
  readonly detailsOverLimit = computed(() => this.commentForm.responseDetails().value().length > this.responseDetailsLimit);
}
