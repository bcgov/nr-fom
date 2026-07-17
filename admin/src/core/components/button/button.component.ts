import { Component, Input, inject } from '@angular/core';
import { StateService } from '@admin-core/services/state.service';

@Component({
    standalone: true,
    selector: 'app-button',
    template: `
        <div class="btn-container">

   <button
            [disabled]="disabled"
            class="btn btn-primary ms-1"
            type="button"
          >
            <i class="spinner rotating" [hidden]="!stateSvc.loading"></i>
            <ng-content></ng-content>
          </button>
          <span title="{{title}}"></span>

        </div>

  `,
    styleUrls: ['./button.component.scss']
})
export class ButtonComponent {
  stateSvc = inject(StateService);

  @Input() title: string;
  @Input() disabled: boolean;

}
