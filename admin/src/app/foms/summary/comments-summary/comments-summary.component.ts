import { StateService } from '@admin-core/services/state.service';
import { Component, OnInit, ViewChild, computed, inject, input } from '@angular/core';
import { MatAccordion, MatExpansionModule } from '@angular/material/expansion';
import { PublicCommentAdminResponse, ResponseCodeEnum } from '@api-client';
import { indexBy } from 'remeda';

import { NewlinesPipe } from '@admin-core/pipes/newlines.pipe';
import { DatePipe, NgStyle, NgTemplateOutlet } from '@angular/common';
import { MatBadgeModule } from '@angular/material/badge';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
    imports: [
    MatExpansionModule,
    NgStyle,
    MatIconModule,
    MatBadgeModule,
    MatCardModule,
    NgTemplateOutlet,
    DatePipe,
    NewlinesPipe
],
    selector: 'app-comments-summary',
    templateUrl: './comments-summary.component.html',
    styleUrl: './comments-summary.component.scss',
})
export class CommentsSummaryComponent implements OnInit {
  private stateSvc = inject(StateService);


  commentScopeCodes = indexBy(this.stateSvc.getCodeTable('commentScopeCode'), (x) => x.code);

  readonly publicCommentDetails = input<PublicCommentAdminResponse[]>();
  readonly requestError = input<boolean | undefined>(undefined);

  // Derived comment buckets (replaces the former `publicCommentDetails` setter side-effects).
  private readonly categorized = computed(() => {
    const addressed: PublicCommentAdminResponse[] = [];
    const considered: PublicCommentAdminResponse[] = [];
    const irrelevant: PublicCommentAdminResponse[] = [];
    const noResponse: PublicCommentAdminResponse[] = [];

    this.publicCommentDetails()?.forEach((comment) => {
      const item = Object.assign({}, comment); // JSON.parse(JSON.stringify(comment))
      if (comment.response?.code === ResponseCodeEnum.Addressed) {
        addressed.push(item);
      }
      else if (comment.response?.code === ResponseCodeEnum.Considered) {
        considered.push(item);
      }
      else if (comment.response?.code === ResponseCodeEnum.Irrelevant) {
        irrelevant.push(item);
      }
      else {
        noResponse.push(item);
      }
    });

    return { addressed, considered, irrelevant, noResponse };
  });

  readonly addressedPcs = computed(() => this.categorized().addressed);
  readonly consideredPcs = computed(() => this.categorized().considered);
  readonly irrelevantPcs = computed(() => this.categorized().irrelevant);
  readonly noResponsePcs = computed(() => this.categorized().noResponse);

  @ViewChild(MatAccordion)
  accordion: MatAccordion;

  ngOnInit(): void {
    // Deliberately empty
  }

}
