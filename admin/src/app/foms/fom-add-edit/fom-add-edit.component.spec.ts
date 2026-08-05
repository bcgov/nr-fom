import { UploadBoxComponent } from '@admin-core/components/file-upload-box/file-upload-box.component';
import { AttachmentResolverSvc } from '@admin-core/services/AttachmentResolverSvc';
import { CognitoService } from '@admin-core/services/cognito.service';
import { LoadingService } from '@admin-core/services/loading.service';
import { ModalService } from '@admin-core/services/modal.service';
import { StateService } from '@admin-core/services/state.service';
import { AttachmentUploadService } from '@admin-core/utils/attachmentUploadService';
import { Component, input, output, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { ForestClientService, ProjectService } from '@api-client';
import { RxFormBuilder } from '@rxweb/reactive-form-validators';
import { of } from 'rxjs';
import { FomAddEditComponent } from './fom-add-edit.component';

// @ngx-dropzone does not work in jsdom and is irrelevant to what is under test here.
@Component({ selector: 'app-upload-box', template: '' })
class StubUploadBoxComponent {
  readonly fileTypes = input<string[]>();
  readonly maxFileSizeMB = input<number>();
  readonly attachmentType = input<unknown>();
  readonly title = input<string>();
  readonly fileEmit = output<File | null>();
}

// The template binds every control below, so the builder must return a group containing all of them.
function buildFormGroup() {
  return new FormGroup({
    name: new FormControl(null),
    description: new FormControl(null),
    commentingOpenDate: new FormControl(null),
    commentingClosedDate: new FormControl(null),
    opStartDate: new FormControl(null),
    opEndDate: new FormControl(null),
    projectPlanCode: new FormControl('FSP'),
    fspId: new FormControl(null),
    woodlotLicenseNumber: new FormControl(null),
    bctsMgrName: new FormControl(null),
    forestClient: new FormControl(null),
    district: new FormControl(null),
    workflowState: new FormControl(null),
  });
}

describe('FomAddEditComponent', () => {
  let component: FomAddEditComponent;
  let fixture: ComponentFixture<FomAddEditComponent>;
  let findOneMock: jest.Mock;
  let getAttachmentsMock: jest.Mock;
  let forestClientFindMock: jest.Mock;

  const forestClients = [
    { id: 1, name: 'Client One' },
    { id: 2, name: 'Client Two' },
  ];

  function existingProject(workflowStateCode = 'INITIAL') {
    return {
      id: 7,
      name: 'Existing FOM',
      description: 'Existing description',
      revisionCount: 1,
      commentingOpenDate: '2026-01-01',
      commentingClosedDate: '2026-03-01',
      operationStartYear: 2026,
      operationEndYear: 2027,
      projectPlanCode: 'FSP',
      workflowState: { code: workflowStateCode },
      forestClient: { id: 1, name: 'Client One' },
      district: { id: 3, name: 'A District' },
    };
  }

  async function createComponent(opts: { mode: 'create' | 'edit'; appId?: string }) {
    fixture = TestBed.createComponent(FomAddEditComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('mode', opts.mode);
    fixture.componentRef.setInput('appId', opts.appId);

    fixture.detectChanges();
    await flush();
  }

  // whenStable() alone is not enough: it tracks Angular's own pending work, so it would wait for a
  // resource but not a bare subscribe or a floating promise. Flush the macrotask queue explicitly.
  async function flush() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    findOneMock = jest.fn().mockReturnValue(of(existingProject()));
    getAttachmentsMock = jest.fn().mockResolvedValue([
      { id: 11, fileName: 'notice.pdf', attachmentType: { code: 'PUBLIC_NOTICE' } },
      { id: 12, fileName: 'support-a.pdf', attachmentType: { code: 'SUPPORTING_DOC' } },
      { id: 13, fileName: 'support-b.pdf', attachmentType: { code: 'SUPPORTING_DOC' } },
    ]);
    forestClientFindMock = jest.fn().mockReturnValue(of(forestClients));

    await TestBed.configureTestingModule({
      imports: [FomAddEditComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {
          provide: ProjectService,
          useValue: {
            projectControllerFindOne: findOneMock,
            projectControllerCreate: jest.fn().mockReturnValue(of({ id: 7 })),
            projectControllerUpdate: jest.fn().mockReturnValue(of({ id: 7 })),
          },
        },
        { provide: ForestClientService, useValue: { forestClientControllerFind: forestClientFindMock } },
        {
          provide: AttachmentResolverSvc,
          useValue: {
            getAttachments: getAttachmentsMock,
            attachmentControllerRemove: jest.fn().mockResolvedValue({}),
            isDeleteAttachmentAllowed: () => true,
            getFileContents: jest.fn(),
          },
        },
        { provide: AttachmentUploadService, useValue: { attachmentCreateUpdate: jest.fn() } },
        { provide: StateService, useValue: { getCodeTable: () => [{ id: 3, name: 'A District' }] } },
        { provide: LoadingService, useValue: { loading: signal(false) } },
        { provide: CognitoService, useValue: { getUser: () => ({ isMinistry: true, isForestClient: false, isAuthorizedForClientId: () => true }) } },
        { provide: ModalService, useValue: { openWarningDialog: jest.fn(), openConfirmationDialog: jest.fn() } },
        { provide: MatSnackBar, useValue: { open: jest.fn(), dismiss: jest.fn() } },
        { provide: RxFormBuilder, useValue: { formGroup: jest.fn().mockImplementation(buildFormGroup) } },
      ],
    })
      .overrideComponent(FomAddEditComponent, {
        remove: { imports: [UploadBoxComponent] },
        add: { imports: [StubUploadBoxComponent] },
      })
      .compileComponents();
  });

  describe('edit mode', () => {
    beforeEach(async () => {
      await createComponent({ mode: 'edit', appId: '7' });
    });

    it('loads the FOM being edited', () => {
      expect(findOneMock).toHaveBeenCalledWith(7);
      expect(component.isCreate).toBe(false);
    });

    it('renders the form once loading completes', () => {
      expect(component.fg).toBeDefined();
      expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    });

    it('preselects the district and forest client from the loaded FOM', () => {
      expect(component.districtIdSelect).toBe(3);
      expect(component.forestClientSelect).toBe(1);
    });

    it('derives the workflow state flags from the loaded FOM', () => {
      expect(component.isInitialState).toBe(true);
      expect(component.isCommentingOpenState).toBe(false);
      expect(component.isCommentingClosedState).toBe(false);
      expect(component.isPublishState).toBe(false);
    });

    it('seeds the description character counter from the loaded FOM', () => {
      expect(component.descriptionValue).toBe('Existing description');
    });
  });

  describe('workflow state flags', () => {
    it('flags a commenting-open FOM', async () => {
      findOneMock.mockReturnValue(of(existingProject('COMMENT_OPEN')));
      await createComponent({ mode: 'edit', appId: '7' });
      expect(component.isCommentingOpenState).toBe(true);
      expect(component.isInitialState).toBe(false);
    });

    it('flags a commenting-closed FOM', async () => {
      findOneMock.mockReturnValue(of(existingProject('COMMENT_CLOSED')));
      await createComponent({ mode: 'edit', appId: '7' });
      expect(component.isCommentingClosedState).toBe(true);
    });

    it('flags a published FOM', async () => {
      findOneMock.mockReturnValue(of(existingProject('PUBLISHED')));
      await createComponent({ mode: 'edit', appId: '7' });
      expect(component.isPublishState).toBe(true);
    });
  });

  describe('attachments', () => {
    beforeEach(async () => {
      await createComponent({ mode: 'edit', appId: '7' });
    });

    it('separates the public notice from the supporting documents', () => {
      expect(getAttachmentsMock).toHaveBeenCalledWith(7);
      expect(component.attachmentsInitialNotice().map((a) => a.id)).toEqual([11]);
      expect(component.attachments().map((a) => a.id)).toEqual([12, 13]);
    });

    it('renders the supporting document file names', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('support-a.pdf');
      expect(text).toContain('support-b.pdf');
    });
  });

  describe('forest clients', () => {
    beforeEach(async () => {
      await createComponent({ mode: 'edit', appId: '7' });
    });

    it('loads the selectable forest clients', () => {
      expect(forestClientFindMock).toHaveBeenCalled();
      expect(component.forestClients().map((c) => c.id)).toEqual([1, 2]);
    });

    // The FOM Holder <select> only exists while creating; an existing FOM shows a read-only input,
    // because the holder cannot be changed after creation.
    it('renders them as options on the create form', async () => {
      await createComponent({ mode: 'create' });

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Client One');
      expect(text).toContain('Client Two');
    });
  });

  describe('create mode', () => {
    beforeEach(async () => {
      await createComponent({ mode: 'create' });
    });

    it('does not fetch a FOM', () => {
      expect(findOneMock).not.toHaveBeenCalled();
      expect(component.isCreate).toBe(true);
    });

    it('does not fetch attachments', () => {
      expect(getAttachmentsMock).not.toHaveBeenCalled();
    });

    it('still renders the form', () => {
      expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    });

    it('still loads the forest client list', () => {
      expect(forestClientFindMock).toHaveBeenCalled();
    });
  });

  describe('before loading completes', () => {
    it('renders no form', () => {
      fixture = TestBed.createComponent(FomAddEditComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('mode', 'edit');
      fixture.componentRef.setInput('appId', '7');
      // findOne never emits, so the form group is never built.
      findOneMock.mockReturnValue(of());

      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('form')).toBeNull();
    });
  });

  describe('canDeactivate', () => {
    it('allows leaving an untouched form', async () => {
      await createComponent({ mode: 'edit', appId: '7' });
      expect(component.canDeactivate()).toBe(true);
    });

    it('blocks leaving a dirty form', async () => {
      await createComponent({ mode: 'edit', appId: '7' });
      component.fg.markAsDirty();
      expect(component.canDeactivate()).toBe(false);
    });
  });
});
