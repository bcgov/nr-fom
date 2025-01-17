import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ProjectPlanCodeEnum, ProjectPublicSummaryResponse } from '@api-client';
import { StateService } from '@public-core/services/state.service';
import { UrlService } from '@public-core/services/url.service';
import { indexBy } from 'remeda';
import { Panel } from '../../../applications/utils/panel.enum';

@Component({
  standalone: true,
  imports: [CommonModule],
  templateUrl: './marker-popup.component.html',
  styleUrls: ['./marker-popup.component.scss']
})
export class MarkerPopupComponent {
  public projectSummary: ProjectPublicSummaryResponse;
  public workflowStatus = indexBy(this.stateSvc.getCodeTable('workflowStateCode'), (x) => x.code);
  readonly projectPlanCodeEnum = ProjectPlanCodeEnum;
  
  constructor(
    private stateSvc: StateService,
    public urlService: UrlService
  ) {}

  public showDetails() {
    this.urlService.setQueryParam('id', this.projectSummary.id.toString());
    this.urlService.setFragment(Panel.details);
  }
}
