import { Component, OnInit, computed, inject, input, viewChild } from '@angular/core';
import { MatAccordion, MatExpansionModule } from '@angular/material/expansion';
import { InteractionResponse } from '@api-client';
import { ConfigService } from '@utility/services/config.service';

import { NewlinesPipe } from '@admin-core/pipes/newlines.pipe';
import { AttachmentResolverSvc } from '@admin-core/services/AttachmentResolverSvc';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { MatBadgeModule } from '@angular/material/badge';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
    imports: [
    MatExpansionModule,
    MatIconModule,
    MatBadgeModule,
    MatCardModule,
    NgTemplateOutlet,
    DatePipe,
    NewlinesPipe
],
    selector: 'app-interactions-summary',
    templateUrl: './interactions-summary.component.html',
    styleUrl: './interactions-summary.component.scss',
})
export class InteractionsSummaryComponent implements OnInit {
  private configSvc = inject(ConfigService);
  attachmentResolverSvc = inject(AttachmentResolverSvc);


  readonly interactionDetails = input<InteractionResponse[]>();
  readonly interactions = computed(() => this.interactionDetails() ?? []);

  readonly requestError = input<boolean | undefined>(undefined);

  readonly accordion = viewChild(MatAccordion);

  ngOnInit(): void {
    // Deliberately empty
  }

}
