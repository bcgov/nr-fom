import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { from, of } from 'rxjs';

import { InteractionsComponent } from './interactions.component';
import { CognitoService } from '@admin-core/services/cognito.service';
import { ModalService } from '@admin-core/services/modal.service';
import { AttachmentResolverSvc } from '@admin-core/services/AttachmentResolverSvc';
import { AttachmentService, InteractionService } from '@api-client';
import { RxFormBuilder } from '@rxweb/reactive-form-validators';

// Mimics a real HTTP response: resolves on a later microtask/macrotask, never synchronously like of().
function asyncOf<T>(value: T) {
  return from(new Promise<T>((resolve) => setTimeout(() => resolve(value), 0)));
}

describe('InteractionsComponent', () => {
  let component: InteractionsComponent;
  let fixture: ComponentFixture<InteractionsComponent>;
  let findMock: jest.Mock;
  let createMock: jest.Mock;

  const project = {
    id: 1,
    forestClient: { id: 99 },
    workflowState: { code: 'COMMENT_OPEN' },
    commentingOpenDate: '2026-01-01',
  };

  beforeEach(async () => {
    findMock = jest.fn()
      .mockReturnValueOnce(asyncOf([])) // initial load: empty list
      .mockReturnValue(asyncOf([{ id: 2, stakeholder: 'Test', communicationDate: '2026-01-02', communicationDetails: 'saved' }])); // after save

    createMock = jest.fn().mockReturnValue({
      toPromise: () => new Promise((resolve) => setTimeout(() => resolve({ id: 2, stakeholder: 'Test', communicationDate: '2026-01-02', communicationDetails: 'saved', revisionCount: 1 }), 0)),
    });

    await TestBed.configureTestingModule({
      imports: [InteractionsComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {
          provide: InteractionService,
          useValue: {
            interactionControllerFind: findMock,
            interactionControllerCreate: createMock,
            interactionControllerRemove: jest.fn(),
          },
        },
        { provide: CognitoService, useValue: { getUser: jest.fn().mockReturnValue({ isAuthorizedForClientId: () => true }) } },
        { provide: ModalService, useValue: { openConfirmationDialog: jest.fn() } },
        { provide: AttachmentService, useValue: { attachmentControllerFind: jest.fn().mockReturnValue(of([])) } },
        { provide: AttachmentResolverSvc, useValue: { getAttachments: jest.fn(), getFileContents: jest.fn() } },
        {
          provide: RxFormBuilder,
          useValue: { formGroup: jest.fn().mockReturnValue({ disable: jest.fn(), get: jest.fn().mockReturnValue({ setValue: jest.fn() }), value: {} }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InteractionsComponent);
    component = fixture.componentInstance;
    // Route-bound inputs (withComponentInputBinding in production) supplied directly in the test.
    fixture.componentRef.setInput('appId', '1');
    fixture.componentRef.setInput('project', project);
  });

  function listText(): string {
    return fixture.nativeElement.textContent;
  }

  it('refreshes the engagement list after a successful save, without an explicit fixture.detectChanges() call', async () => {
    // autoDetectChanges mirrors production: Angular re-renders on its own whenever
    // the zone observes the app has gone idle, exactly like a running browser tab.
    fixture.autoDetectChanges(true);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(listText()).toContain('Engagements (0)');
    expect(findMock).toHaveBeenCalledTimes(1);

    await component.saveInteraction(
      {
        communicationDatePickerDate: new Date('2026-01-02'),
        communicationDetails: 'saved',
        stakeholder: 'Test',
        filename: null,
        fileContent: null,
      } as any,
      {} as any, // new interaction, no id -> create path
    );

    // Give the save promise chain, the resource.reload() change-detection cycle, and the
    // follow-up refetch a few turns of the event loop, same as a real browser would provide.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(findMock).toHaveBeenCalledTimes(2);
    expect(listText()).toContain('Engagements (1)');
    expect(listText()).toContain('saved');
  });
});
