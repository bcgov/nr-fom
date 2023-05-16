import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { MatAccordion, MatExpansionModule } from '@angular/material/expansion';
import { InteractionResponse } from '@api-client';
import { ConfigService } from '@utility/services/config.service';

import { NewlinesPipe } from '@admin-core/pipes/newlines.pipe';
import { DatePipe, NgFor, NgStyle, NgTemplateOutlet } from '@angular/common';
import { MatBadgeModule } from '@angular/material/badge';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
    standalone: true,
    imports: [
        MatExpansionModule, 
        NgStyle, 
        MatIconModule, 
        MatBadgeModule, 
        NgFor, 
        MatCardModule, 
        NgTemplateOutlet, 
        DatePipe,
        NewlinesPipe
    ],
    selector: 'app-interactions-summary',
    templateUrl: './interactions-summary.component.html',
    styleUrls: ['./interactions-summary.component.scss'],
})
export class InteractionsSummaryComponent implements OnInit {

  interactions: InteractionResponse[] = [];

  @Input() 
  requestError: boolean
  
  @ViewChild(MatAccordion) 
  accordion: MatAccordion;
  
  constructor(private configSvc: ConfigService) { }

  ngOnInit(): void {
    // Deliberately empty
  }

  @Input() set interactionDetails(interactions: InteractionResponse[]) {
    this.interactions = interactions;
  }

  getAttachmentUrl(id: number): string {
    return this.configSvc.getAttachmentUrl(id);
  }
}
