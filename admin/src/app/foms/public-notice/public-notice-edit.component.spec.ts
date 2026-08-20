import { CognitoService } from '@admin-core/services/cognito.service';
import { LoadingService } from '@admin-core/services/loading.service';
import { ModalService } from '@admin-core/services/modal.service';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { PublicNoticeService } from '@api-client';
import { RxFormBuilder } from '@rxweb/reactive-form-validators';
import { from } from 'rxjs';
import { PublicNoticeEditComponent } from './public-notice-edit.component';

// Mimics a real HTTP response: resolves on a later microtask/macrotask, never synchronously like of().
function asyncOf<T>(value: T) {
  return from(new Promise<T>((resolve) => setTimeout(() => resolve(value), 0)));
}

// The template binds every control below, so the builder must return a group containing all of them.
function buildFormGroup() {
  return new FormGroup({
    pnPostDate: new FormControl(null),
    reviewAddress: new FormControl(null),
    reviewBusinessHours: new FormControl(null),
    isReceiveCommentsSameAsReview: new FormControl(false),
    receiveCommentsAddress: new FormControl(null),
    receiveCommentsBusinessHours: new FormControl(null),
    mailingAddress: new FormControl(null),
    email: new FormControl(null),
  });
}

describe('PublicNoticeEditComponent', () => {
  let component: PublicNoticeEditComponent;
  let fixture: ComponentFixture<PublicNoticeEditComponent>;
  let findOneMock: jest.Mock;
  let findLatestMock: jest.Mock;
  let createMock: jest.Mock;
  let updateMock: jest.Mock;
  let router: Router;

  const existingNotice = {
    id: 55,
    projectId: 2,
    revisionCount: 3,
    postDate: '2026-02-01',
    reviewAddress: 'Existing address',
  };

  const clientLatestNotice = {
    id: 77,
    projectId: 9,
    revisionCount: 1,
    postDate: '2025-01-01',
    reviewAddress: 'Client previous address',
  };

  /** projectDetail as delivered by the route resolver. `publicNoticeId` decides which fetch runs. */
  function projectDetail(publicNoticeId?: number, workflowStateCode = 'INITIAL') {
    return {
      id: 2,
      publicNoticeId,
      commentingOpenDate: '2099-12-31',
      forestClient: { id: 99 },
      workflowState: { code: workflowStateCode },
    };
  }

  async function createComponent(opts: { publicNoticeId?: number; editMode: boolean; workflowStateCode?: string }) {
    fixture = TestBed.createComponent(PublicNoticeEditComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('appId', '2');
    fixture.componentRef.setInput('projectDetail', projectDetail(opts.publicNoticeId, opts.workflowStateCode));
    fixture.componentRef.setInput('editMode', opts.editMode);

    fixture.detectChanges();   // first render: kicks off the fetch
    // Flush the macrotask the mocked HTTP response resolves on. whenStable() alone is not enough:
    // it tracks Angular's own pending work, so it would wait for a resource but not a bare subscribe.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
    fixture.detectChanges();   // render again now the notice has arrived
  }

  beforeEach(async () => {
    findOneMock = jest.fn().mockReturnValue(asyncOf(existingNotice));
    findLatestMock = jest.fn().mockReturnValue(asyncOf(clientLatestNotice));
    createMock = jest.fn().mockReturnValue(asyncOf({ id: 101 }));
    updateMock = jest.fn().mockReturnValue(asyncOf({ id: 55 }));

    await TestBed.configureTestingModule({
      imports: [PublicNoticeEditComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {
          provide: PublicNoticeService,
          useValue: {
            publicNoticeControllerFindOne: findOneMock,
            publicNoticeControllerFindLatestPublicNotice: findLatestMock,
            publicNoticeControllerCreate: createMock,
            publicNoticeControllerUpdate: updateMock,
          },
        },
        { provide: CognitoService, useValue: { getUser: () => ({ isForestClient: true, isAuthorizedForClientId: () => true }) } },
        { provide: ModalService, useValue: { openWarningDialog: jest.fn(), openConfirmationDialog: jest.fn() } },
        { provide: LoadingService, useValue: { loading: signal(false) } },
        { provide: RxFormBuilder, useValue: { formGroup: jest.fn().mockImplementation(buildFormGroup) } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
  });

  describe('when the project already has a public notice', () => {
    beforeEach(async () => {
      await createComponent({ publicNoticeId: 55, editMode: true });
    });

    it('fetches that notice by id, not the forest client latest', () => {
      expect(findOneMock).toHaveBeenCalledWith(55);
      expect(findLatestMock).not.toHaveBeenCalled();
    });

    it('is not treated as a new notice', () => {
      expect(component.isNewForm).toBe(false);
      expect(component.isAddNewNotice()).toBe(false);
    });

    it('keeps the fetched notice for later update/delete calls', () => {
      expect(component.publicNoticeResponse!.id).toBe(55);
      expect(component.publicNoticeResponse!.revisionCount).toBe(3);
    });

    it('derives maxPostDate from the project commenting open date', () => {
      expect(component.maxPostDate.getFullYear()).toBe(2099);
    });

    it('renders the form once the notice has loaded', () => {
      expect(component.publicNoticeFormGroup).toBeDefined();
      expect(fixture.nativeElement.querySelector('form#publicNoticeForm')).not.toBeNull();
    });
  });

  describe('when the project has no public notice yet', () => {
    beforeEach(async () => {
      await createComponent({ publicNoticeId: undefined, editMode: true });
    });

    it('prefills from the forest client latest notice', () => {
      expect(findLatestMock).toHaveBeenCalledWith(99);
      expect(findOneMock).not.toHaveBeenCalled();
    });

    it('is treated as a new notice', () => {
      expect(component.isNewForm).toBe(true);
      expect(component.isAddNewNotice()).toBe(true);
    });

    it('drops the inherited post date so operation years are not carried over', () => {
      expect(component.publicNoticeResponse!.postDate).toBeUndefined();
    });
  });

  describe('when the project and forest client have no prior public notice at all', () => {
    beforeEach(async () => {
      findLatestMock.mockReturnValue(asyncOf(null));
      await createComponent({ publicNoticeId: undefined, editMode: true });
    });

    it('queries the latest notice for the forest client', () => {
      expect(findLatestMock).toHaveBeenCalledWith(99);
      expect(findOneMock).not.toHaveBeenCalled();
    });

    it('is treated as a new notice and renders an empty form with actions', () => {
      expect(component.isNewForm).toBe(true);
      expect(component.isAddNewNotice()).toBe(true);
      expect(component.publicNoticeResponse).toBeNull();
      expect(component.formReady()).toBe(true);
      expect(component.publicNoticeFormGroup).toBeDefined();
      expect(fixture.nativeElement.querySelector('form#publicNoticeForm')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('h1').textContent).toContain('New Online Public Notice');
      expect(fixture.nativeElement.querySelector('h1').textContent).toContain('FOM Number: 2');
      expect(fixture.nativeElement.querySelector('button[type="submit"]')).not.toBeNull();
    });

    it('submits a new public notice on valid form submission and navigates back', async () => {
      const navSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
      await component.onSubmit();
      expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ projectId: 2 }));
      expect(updateMock).not.toHaveBeenCalled();
      expect(navSpy).toHaveBeenCalledWith(['/a', 2]);
    });
  });

  describe('view mode', () => {
    beforeEach(async () => {
      await createComponent({ publicNoticeId: 55, editMode: false });
    });

    it('disables the whole form', () => {
      expect(component.publicNoticeFormGroup.disabled).toBe(true);
    });

    it('is never an add-new-notice screen', () => {
      expect(component.isAddNewNotice()).toBe(false);
    });

    // Delete is gated on workflow state and client authorization, NOT on view/edit mode.
    it('still offers delete for an authorized forest client while the FOM is INITIAL', () => {
      expect(component.canDelete()).toBe(true);
    });
  });

  describe('delete availability', () => {
    it('is withheld once the FOM has left the INITIAL state', async () => {
      await createComponent({ publicNoticeId: 55, editMode: true, workflowStateCode: 'PUBLISHED' });
      expect(component.canDelete()).toBe(false);
    });

    it('is withheld while adding a brand new notice', async () => {
      await createComponent({ publicNoticeId: undefined, editMode: true });
      expect(component.isAddNewNotice()).toBe(true);
      expect(component.canDelete()).toBe(false);
    });
  });

  describe('before the notice arrives', () => {
    it('renders no form', () => {
      fixture = TestBed.createComponent(PublicNoticeEditComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('appId', '2');
      fixture.componentRef.setInput('projectDetail', projectDetail(55));
      fixture.componentRef.setInput('editMode', true);

      fixture.detectChanges(); // fetch is in flight, nothing resolved yet

      expect(fixture.nativeElement.querySelector('form#publicNoticeForm')).toBeNull();
    });
  });

  describe('navigation', () => {
    beforeEach(async () => {
      await createComponent({ publicNoticeId: 55, editMode: true });
    });

    it('cancelChanges returns to the FOM detail page for this project', () => {
      const navSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
      component.cancelChanges();
      expect(navSpy).toHaveBeenCalledWith(['/a', 2]);
    });
  });
});
