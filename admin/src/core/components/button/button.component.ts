import { Component, booleanAttribute, inject, input } from '@angular/core';
import { LoadingService } from '@admin-core/services/loading.service';

@Component({
    selector: 'app-button',
    template: `
        <div class="btn-container">

   <button
            [disabled]="disabled()"
            class="btn btn-primary ms-1"
            type="button"
          >
            <i class="spinner rotating" [hidden]="!loadingSvc.loading()"></i>
            <ng-content />
          </button>
          <span title="{{title()}}"></span>

        </div>

  `,
    styleUrl: './button.component.scss'
})
export class ButtonComponent {
  loadingSvc = inject(LoadingService);

  readonly title = input('');
  readonly disabled = input(false, { transform: booleanAttribute });

}
