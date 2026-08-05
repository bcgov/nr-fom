import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StateService } from '@admin-core/services/state.service';
import { CommentDetailComponent } from './comment-detail.component';

const makeComment = (over: Record<string, unknown> = {}) =>
  ({
    id: 1,
    name: 'A',
    email: 'a@b.c',
    phoneNumber: '123',
    location: 'loc',
    createTimestamp: '2026-01-01T00:00:00.000Z',
    feedback: 'feedback',
    commentScope: { description: 'd', code: 'CUT_BLOCK' },
    scopeCutBlockId: 1,
    scopeRoadSectionId: null,
    scopeFeatureName: null,
    responseDetails: 'hi',
    revisionCount: 3,
    response: { code: 'CONSIDERED' },
    ...over,
  }) as any;

const stateServiceMock = {
  getCodeTable: (table: string) =>
    table === 'commentScopeCode' ? [{ code: 'CUT_BLOCK' }, { code: 'ROAD_SECTION' }] : [],
};

describe('CommentDetailComponent', () => {
  let fixture: ComponentFixture<CommentDetailComponent>;
  let component: CommentDetailComponent;

  function setup(comment: any, opts: { canReplyComment?: boolean } = {}) {
    TestBed.configureTestingModule({
      imports: [CommentDetailComponent],
      providers: [{ provide: StateService, useValue: stateServiceMock }],
    });
    fixture = TestBed.createComponent(CommentDetailComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('selectedComment', comment);
    if (opts.canReplyComment !== undefined) {
      fixture.componentRef.setInput('canReplyComment', opts.canReplyComment);
    }
    fixture.detectChanges();
  }

  function setField(field: 'responseCode' | 'responseDetails', value: string) {
    component.commentForm[field]().value.set(value);
    fixture.detectChanges();
  }

  it('creates', () => {
    setup(makeComment());
    expect(component).toBeTruthy();
  });

  it('seeds the form model from the selected comment (value maps 1:1 to the update DTO)', () => {
    setup(makeComment({ responseDetails: 'hello', revisionCount: 7, response: { code: 'ADDRESSED' } }));
    expect(component.value).toEqual({ responseDetails: 'hello', responseCode: 'ADDRESSED', revisionCount: 7 });
  });

  it('uses an empty (invalid) responseCode when the comment has no prior response', () => {
    setup(makeComment({ response: undefined }), { canReplyComment: true });
    expect(component.value.responseCode).toBe('');
    expect(component.commentForm.responseCode().valid()).toBe(false); // required
  });

  it('becomes valid once a response code is chosen', () => {
    setup(makeComment({ response: undefined }), { canReplyComment: true });
    setField('responseCode', 'CONSIDERED');
    expect(component.commentForm.responseCode().valid()).toBe(true);
    expect(component.value.responseCode).toBe('CONSIDERED');
  });

  it('reseeds the model when a different comment is selected', () => {
    setup(makeComment({ responseDetails: 'first', revisionCount: 1 }));
    fixture.componentRef.setInput(
      'selectedComment',
      makeComment({ responseDetails: 'second', revisionCount: 2, response: { code: 'IRRELEVANT' } }),
    );
    fixture.detectChanges();
    expect(component.value).toEqual({ responseDetails: 'second', responseCode: 'IRRELEVANT', revisionCount: 2 });
  });

  it('disables the fields when the user cannot reply', () => {
    setup(makeComment(), { canReplyComment: false });
    expect(component.commentForm.responseCode().disabled()).toBe(true);
    expect(component.commentForm.responseDetails().disabled()).toBe(true);
  });

  it('enables the fields when the user can reply', () => {
    setup(makeComment(), { canReplyComment: true });
    expect(component.commentForm.responseCode().disabled()).toBe(false);
  });

  it('flags responseDetails that exceeds the max length', () => {
    setup(makeComment({ responseDetails: '' }), { canReplyComment: true });
    setField('responseDetails', 'a'.repeat(4001));
    expect(component.commentForm.responseDetails().valid()).toBe(false);
    expect(component.remainingChars()).toBe(-1);
  });

  it('root form.invalid() gates the parent save: blocks until a code is chosen AND text is within limit', () => {
    setup(makeComment({ response: undefined, responseDetails: '' }), { canReplyComment: true });
    expect(component.commentForm().invalid()).toBe(true); // responseCode required, not yet chosen

    setField('responseCode', 'CONSIDERED');
    expect(component.commentForm().invalid()).toBe(false); // now valid

    setField('responseDetails', 'a'.repeat(4001));
    expect(component.commentForm().invalid()).toBe(true); // over the 4000-char limit
  });

  it('reports detailsOverLimit (drives the inline error message)', () => {
    setup(makeComment({ responseDetails: '' }), { canReplyComment: true });
    expect(component.detailsOverLimit()).toBe(false);

    setField('responseDetails', 'a'.repeat(4000));
    expect(component.detailsOverLimit()).toBe(false); // exactly at the limit is allowed

    setField('responseDetails', 'a'.repeat(4001));
    expect(component.detailsOverLimit()).toBe(true);
  });
});
