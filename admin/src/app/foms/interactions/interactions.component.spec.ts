import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
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
  let removeMock: jest.Mock;

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

    removeMock = jest.fn().mockReturnValue(asyncOf({}));

    await TestBed.configureTestingModule({
      imports: [InteractionsComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {
          provide: InteractionService,
          useValue: {
            interactionControllerFind: findMock,
            interactionControllerCreate: createMock,
            interactionControllerRemove: removeMock,
          },
        },
        { provide: CognitoService, useValue: { getUser: jest.fn().mockReturnValue({ isAuthorizedForClientId: () => true }) } },
        { provide: ModalService, useValue: { openConfirmationDialog: jest.fn().mockReturnValue({ afterClosed: () => of(true) }) } },
        { provide: AttachmentService, useValue: { attachmentControllerFind: jest.fn().mockReturnValue(of([])) } },
        { provide: AttachmentResolverSvc, useValue: { getAttachments: jest.fn(), getFileContents: jest.fn() } },
        {
          provide: RxFormBuilder,
          // Real FormGroup so the detail component's [formGroup] renders when an engagement is selected.
          useValue: {
            formGroup: jest.fn().mockImplementation(() => new FormGroup({
              communicationDatePickerDate: new FormControl(null),
              stakeholder: new FormControl(null),
              communicationDetails: new FormControl(''),
              filename: new FormControl(null),
              fileContent: new FormControl(null),
            })),
          },
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

  async function flush() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('refreshes the engagement list after a successful save', async () => {
    fixture.autoDetectChanges(true);
    await flush();

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

    // Give the save promise chain, resource.reload(), and follow-up refetch time to resolve.
    await flush();

    expect(findMock).toHaveBeenCalledTimes(2);
    expect(listText()).toContain('Engagements (1)');
    expect(listText()).toContain('saved');
  });

  it('shows the first remaining engagement in the detail panel after deleting the selected one', async () => {
    const list = [
      { id: 10, stakeholder: 'A', communicationDate: '2026-01-01', communicationDetails: 'first' },
      { id: 20, stakeholder: 'B', communicationDate: '2026-01-02', communicationDetails: 'second' },
    ];
    findMock.mockReset()
      .mockReturnValueOnce(asyncOf(list))       // initial load: two items
      .mockReturnValue(asyncOf([list[0]]));     // after delete: only the first remains

    fixture.autoDetectChanges(true);
    await flush();

    // Select the second engagement -> its detail is shown.
    component.onInteractionItemClicked(component.data()![1], null);
    await flush();
    expect(component.interactionDetailForm()!.interaction()!.id).toBe(20);

    // Delete the selected (second) engagement.
    await component.deleteInteraction(component.data()![1]);
    await flush();

    // Detail panel now shows the first remaining engagement, not the deleted one.
    expect(component.selectedItem()?.id).toBe(10);
    expect(component.interactionDetailForm()!.interaction()!.id).toBe(10);
  });

  it('clears the detail panel to empty when the last engagement is deleted', async () => {
    const list = [{ id: 10, stakeholder: 'A', communicationDate: '2026-01-01', communicationDetails: 'only' }];
    findMock.mockReset()
      .mockReturnValueOnce(asyncOf(list))  // initial load: one item
      .mockReturnValue(asyncOf([]));       // after delete: empty

    fixture.autoDetectChanges(true);
    await flush();

    component.onInteractionItemClicked(component.data()![0], null);
    await flush();
    expect(component.interactionDetailForm()!.interaction()!.id).toBe(10);
    // The detail form is rendered for the selected engagement (empty state is gone).
    expect(listText()).not.toContain('No engagement selected');

    await component.deleteInteraction(component.data()![0]);
    await flush();

    // No engagements left -> selection cleared and the detail panel actually re-renders to its
    // empty state in the DOM (the regression: the panel used to stay showing the deleted item).
    expect(component.selectedItem()).toBeNull();
    expect(component.interactionDetailForm()!.interaction()).toBeNull();
    expect(listText()).toContain('No engagement selected');
    expect(listText()).toContain('Engagements (0)');
  });
});
