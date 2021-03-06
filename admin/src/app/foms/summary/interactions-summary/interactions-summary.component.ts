import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { MatAccordion } from '@angular/material/expansion';
import { InteractionResponse } from '@api-client';
import { ConfigService } from '@utility/services/config.service';

@Component({
  selector: 'app-interactions-summary',
  templateUrl: './interactions-summary.component.html',
  styleUrls: ['./interactions-summary.component.scss']
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
