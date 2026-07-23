import { CognitoService } from "@admin-core/services/cognito.service";
import { LoadingService } from '@admin-core/services/loading.service';
import { ModalService } from '@admin-core/services/modal.service';
import { DatePipe } from '@angular/common';
import { Component, ElementRef, Injector, OnInit, afterNextRender, computed, inject, input, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { InteractionResponse, InteractionService, ProjectResponse, WorkflowStateEnum } from '@api-client';
import { User } from "@utility/security/user";
import { DateTime } from "luxon";
import { InteractionDetailComponent } from './interaction-detail/interaction-detail.component';
import { InteractionRequest } from './interaction-detail/interaction-detail.form';

export const ERROR_DIALOG = {
  // title: 'The requested project does not exist.',
  // message: 'Please try again.',
  width: '340px',
  height: '200px',
  buttons: {
    cancel: {
      text: 'Close'
    }
  }
};

@Component({
    imports: [
    RouterLink,
    InteractionDetailComponent,
    DatePipe
],
    selector: 'app-interactions',
    templateUrl: './interactions.component.html',
    styleUrl: './interactions.component.scss'
})
export class InteractionsComponent implements OnInit {
  private interactionSvc = inject(InteractionService);
  private cognitoService = inject(CognitoService);
  private modalSvc = inject(ModalService);
  private injector = inject(Injector);
  loadingSvc = inject(LoadingService);


  readonly interactionDetailForm = viewChild<InteractionDetailComponent>('interactionDetailForm');
  public readonly interactionListScrollContainer = viewChild('interactionListScrollContainer', { read: ElementRef });

  readonly appId = input.required<string>();
  readonly project = input.required<ProjectResponse>();
  projectId: number;
  readonly selectedItem = signal<InteractionResponse>(null);
  private user: User;

  // Engagement list. reload() after a save/delete refetches it; the in-flight state for
  // the Save/Delete buttons comes from the global loading signal (interceptor-driven).
  private readonly interactionsResource = rxResource({
    params: () => Number(this.appId()),
    stream: ({ params }) => this.interactionSvc.interactionControllerFind(params),
  });
  readonly data = computed<InteractionResponse[] | undefined>(() =>
    this.interactionsResource.hasValue() ? this.interactionsResource.value() : undefined);

  constructor()
  {
    this.user = this.cognitoService.getUser();
  }

  ngOnInit(): void {
    this.projectId = Number(this.appId());
  }

  onInteractionItemClicked(item: InteractionResponse, pos: number) {
    this.selectedItem.set(item);
    const interactionDetailForm = this.interactionDetailForm();
    if (interactionDetailForm) {
      interactionDetailForm.editMode = this.canModifyInteraction(); // set this first.
      interactionDetailForm.selectedInteraction = item;
    }
    this.setMinDate();
    if (pos) {
      // Restore the list scroll position after the selection re-render lands in the DOM.
      afterNextRender(() => {
        const container = this.interactionListScrollContainer();
        if (container) {
          container.nativeElement.scrollTop = pos;
        }
      }, { injector: this.injector });
    }
  }

  // Verify if condition is met to allow user modifying this Interaction.
  canModifyInteraction() {
    return this.user.isAuthorizedForClientId(this.project().forestClient.id) &&
          (
            (this.project().workflowState.code == WorkflowStateEnum.CommentOpen)
            || (this.project().workflowState.code == WorkflowStateEnum.CommentClosed)
          );
  }

  addEmptyInteractionDetail() {
    this.selectedItem.set(null);
    const interactionDetailForm = this.interactionDetailForm();
    if (interactionDetailForm) {
      interactionDetailForm.editMode = this.canModifyInteraction(); // set this first.
      interactionDetailForm.selectedInteraction = {} as InteractionResponse;
    }
    this.setMinDate();
  }

  setMinDate() {
    const interactionDetailForm = this.interactionDetailForm();
    if (interactionDetailForm) {
      interactionDetailForm.minDate = DateTime.fromISO(this.project().commentingOpenDate).toJSDate();
    }
  }

  async saveInteraction(saveReq: InteractionRequest, selectedInteraction: InteractionResponse) {
    const {id} = selectedInteraction;
    const resultPromise = this.saveRequest(id, this.projectId, saveReq, selectedInteraction);
    resultPromise
      .then((result) => this.handleSaveSuccess(result))
      .catch((err) => this.handleSaveError(err));
  }

  async deleteInteraction(selectedInteraction: InteractionResponse) {
    const dialogRef = this.modalSvc.openConfirmationDialog(`You are about to delete this engagement. Are you sure?`, 'Delete Engagement');
    dialogRef.afterClosed().subscribe((confirm) => {
      if (confirm) {
        this.interactionSvc.interactionControllerRemove(selectedInteraction.id).subscribe(() => {
          // Work out the next selection from the current list minus the deleted item.
          const remaining = (this.data() ?? []).filter(item => item.id !== selectedInteraction.id);
          this.interactionsResource.reload(); // refetch the list
          if (remaining.length > 0) {
            // Show the first remaining engagement in the detail panel.
            this.onInteractionItemClicked(remaining[0], null);
          } else {
            // No engagements left — clear the detail panel to its empty state.
            this.selectedItem.set(null);
            const detailForm = this.interactionDetailForm();
            if (detailForm) {
              detailForm.clear(); // reset the detail panel + force its change detection
            }
          }
        });
      }
    })
  }

  private saveRequest(id: number, projectId: number, saveReq: InteractionRequest, selectedInteraction: InteractionResponse)
          : Promise<InteractionResponse> {
    let resultPromise: Promise<InteractionResponse>;
    saveReq.communicationDate = DateTime.fromJSDate(saveReq.communicationDatePickerDate).toISODate(); // convert datePicker value to YYYY-MM-DD string.

    if (!id) {
      resultPromise = this.interactionSvc.interactionControllerCreate(saveReq.fileContent, projectId,
        saveReq.stakeholder,
        saveReq.communicationDate,
        saveReq.communicationDetails,
        saveReq.filename).toPromise();
    }
    else {
      saveReq.revisionCount = selectedInteraction.revisionCount;
      resultPromise = this.interactionSvc.interactionControllerUpdate(id, saveReq.fileContent,
        this.projectId,
        saveReq.stakeholder,
        saveReq.communicationDate,
        saveReq.communicationDetails,
        saveReq.revisionCount,
        saveReq.filename).toPromise();
    }
    return resultPromise;
  }

  private handleSaveSuccess(result: any) {
    const pos = this.interactionListScrollContainer().nativeElement.scrollTop;
    this.selectedItem.set(result); // updated selected.
    this.interactionsResource.reload(); // refetch the list
    setTimeout(() => {
      this.onInteractionItemClicked(this.selectedItem(), pos);
    }, 300);
  }

  private handleSaveError(err: any) {
    // Let HTTP Error Interceptor show the error for now.
    console.error('Failed to save', err);
  }

}
