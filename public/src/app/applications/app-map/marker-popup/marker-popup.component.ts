import { TitleCasePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ProjectPlanCodeEnum, ProjectPublicSummaryResponse } from '@api-client';
import { StateService } from '@public-core/services/state.service';
import { UrlService } from '@public-core/services/url.service';
import { indexBy } from 'remeda';
import { Panel } from '../../../applications/utils/panel.enum';

@Component({
  imports: [TitleCasePipe],
  templateUrl: './marker-popup.component.html',
  styleUrl: './marker-popup.component.scss'
})
export class MarkerPopupComponent {
  private stateSvc = inject(StateService);
  urlService = inject(UrlService);

  public projectSummary: ProjectPublicSummaryResponse;
  public workflowStatus = indexBy(this.stateSvc.getCodeTable('workflowStateCode'), (x) => x.code);
  readonly projectPlanCodeEnum = ProjectPlanCodeEnum;

  public showDetails() {
    this.urlService.setQueryParam('id', this.projectSummary.id.toString());
    this.urlService.setFragment(Panel.details);
  }
}
