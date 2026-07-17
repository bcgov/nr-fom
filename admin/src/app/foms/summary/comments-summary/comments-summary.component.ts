import { StateService } from '@admin-core/services/state.service';
import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { MatAccordion, MatExpansionModule } from '@angular/material/expansion';
import { PublicCommentAdminResponse, ResponseCodeEnum } from '@api-client';
import { indexBy } from 'remeda';

import { NewlinesPipe } from '@admin-core/pipes/newlines.pipe';
import { DatePipe, NgStyle, NgTemplateOutlet } from '@angular/common';
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
    MatCardModule,
    NgTemplateOutlet,
    DatePipe,
    NewlinesPipe
],
    selector: 'app-comments-summary',
    templateUrl: './comments-summary.component.html',
    styleUrls: ['./comments-summary.component.scss'],
})
export class CommentsSummaryComponent implements OnInit {

  commentScopeCodes = indexBy(this.stateSvc.getCodeTable('commentScopeCode'), (x) => x.code);
  publicComments: PublicCommentAdminResponse[];
  addressedPcs: PublicCommentAdminResponse[];
  consideredPcs: PublicCommentAdminResponse[];
  irrelevantPcs: PublicCommentAdminResponse[];
  noResponsePcs: PublicCommentAdminResponse[];

  @Input() 
  requestError: boolean

  @ViewChild(MatAccordion) 
  accordion: MatAccordion;
  
  constructor(private stateSvc: StateService) { }

  ngOnInit(): void { 
    // Deliberately empty
  }

  @Input() set publicCommentDetails(publicComments: PublicCommentAdminResponse[]) {
    this.publicComments = publicComments;
    this.addressedPcs = [];
    this.consideredPcs = [];
    this.irrelevantPcs = [];
    this.noResponsePcs = [];

    this.publicComments?.forEach((comment)=> {
      const item = Object.assign({}, comment); // JSON.parse(JSON.stringify(comment))
      if (comment.response?.code === ResponseCodeEnum.Addressed) {
        this.addressedPcs.push(item);
      }
      else if (comment.response?.code === ResponseCodeEnum.Considered) {
        this.consideredPcs.push(item);
      }
      else if (comment.response?.code === ResponseCodeEnum.Irrelevant) {
        this.irrelevantPcs.push(item);
      }
      else {
        this.noResponsePcs.push(item)
      }
    });
  }

}
