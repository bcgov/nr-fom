import { Component, booleanAttribute, inject, input } from '@angular/core';
import { StateService } from '@admin-core/services/state.service';

@Component({
    selector: 'app-button',
    template: `
        <div class="btn-container">

   <button
            [disabled]="disabled()"
            class="btn btn-primary ms-1"
            type="button"
          >
            <i class="spinner rotating" [hidden]="!stateSvc.loading"></i>
            <ng-content />
          </button>
          <span title="{{title()}}"></span>

        </div>

  `,
    styleUrl: './button.component.scss'
})
export class ButtonComponent {
  stateSvc = inject(StateService);

  readonly title = input('');
  readonly disabled = input(false, { transform: booleanAttribute });

}
