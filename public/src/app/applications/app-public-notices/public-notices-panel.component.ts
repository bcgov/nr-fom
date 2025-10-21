import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatAccordion, MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ProjectPlanCodeEnum, ProjectResponse, PublicNoticePublicFrontEndResponse, PublicNoticeService } from '@api-client';
import { periodOperationsTxt, woodlotOperationsTxt } from '@public-core/constants/appConstants';
import { ShortenPipe } from '@public-core/pipes/shorten.pipe';
import { UrlService } from '@public-core/services/url.service';
import { DateTime } from "luxon";
import { isNullish } from 'remeda';

import { IUpdateEvent } from '../projects.component';
import { Panel } from '../utils/panel.enum';
import { NoticeFilter, PublicNoticesFilterPanelComponent } from './notices-filter-panel/public-notices-filter-panel.component';
@Component({
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    MatExpansionModule,
    MatTooltipModule,
    MatCardModule,
    ShortenPipe,
    PublicNoticesFilterPanelComponent
  ],
  selector: 'app-public-notices-panel',
  templateUrl: './public-notices-panel.component.html',
  styleUrls: ['./public-notices-panel.component.scss']
})
export class PublicNoticesPanelComponent implements OnInit {
  @Output() update = new EventEmitter<IUpdateEvent>();
  @ViewChild(MatAccordion) accordion: MatAccordion;
  readonly projectPlanCodeEnum = ProjectPlanCodeEnum;
  readonly periodOperationsTxt = periodOperationsTxt;
  readonly woodlotOperationsTxt = woodlotOperationsTxt;
  isLoading = false;
  pNotices: Array<PublicNoticePublicFrontEndResponse>;
  initialPNotices: Array<PublicNoticePublicFrontEndResponse>;
  districtList: string[]

  constructor(
    public urlService: UrlService,
    public publicNoticeService: PublicNoticeService
  ) {}

  ngOnInit(): void {
    this.publicNoticeService
      .publicNoticeControllerFindListForPublicFrontEnd()
      .subscribe((results) => {
        this.initialPNotices = results;
        if (this.initialPNotices) {
          this.pNotices = [...this.initialPNotices];
          this.districtList = [...new Set(
              this.pNotices
                .filter(pn => pn.project.district != undefined)
                .map(pn => pn.project.district?.name)
            )].sort();
        }
      });
  }

  public showDetails(id: number) {
    this.update.emit({ search: false, resetMap: false, hidePanel: true });
    setTimeout(() => {
      this.urlService.setQueryParam('id', id.toString());
      this.urlService.setFragment(Panel.details);
    }, 450);
  }

  public handlePublicNoticesFilterUpdate(updateEvent: NoticeFilter) {
    const filterConditions = [
      this.condition('project.forestClient.name', 
        updateEvent.forestClientName?.value?.trim(), this.compareFn().in),

      this.condition('project.commentingOpenDate', 
        updateEvent.commentingOpenDate.value, this.compareFn().isDateOnOrAfter),
        
      this.condition('project.district.name', 
        updateEvent.districtName?.value?.trim(), this.compareFn().equal)
    ]

    const filteredResult = [...this.initialPNotices].filter( pn => {
      const resolved = filterConditions.map(cn => cn(pn));
      return resolved.every(x => x === true);
    });

    this.pNotices = [...filteredResult];
  }

  isFomAvailable(commentingOpenDate) {
    return DateTime.fromISO(commentingOpenDate).startOf('day') <= DateTime.now().startOf('day');
  }

  getValidityStartDate(project: ProjectResponse) {
    // Note: special rule for BCTS FOMs: validity period is 3 years from commenting close date. 
    if (project.bctsMgrName)
      return project.commentingClosedDate;
    
    // For Non-BCTS FOMs: validity period is 3 years from commenting open date. 
    else 
      return project.commentingOpenDate;
  }

  private compareFn() {
    // If 'value'(filter value) is null or underfined, consider this as to include all.
    return {
      equal: function(dataValue: string, filterValue: string) {
        return isNullish(filterValue) || dataValue === filterValue;
      },
      in: function(dataValue: string, filterValue: string) {
        return isNullish(filterValue) || dataValue.includes(filterValue);
      },
      isDateOnOrAfter: function(date1: Date, date2: Date) {
        return isNullish(date2) || 
            DateTime.fromJSDate(date1).startOf('day') >= DateTime.fromJSDate(date2).startOf('day');
      }
    }
  }

  private condition(
    key: string, // can be a dot notation path string.
    filterValue: string | Date, 
    comparFn: Function) {

    if (typeof filterValue === 'string') {
      filterValue = filterValue.toLowerCase();
    }

    // Utility to resolve dot-path string (e.g., 'project.district.name')
    function resolvePath(obj: any, path: string) {
      return path.split('.').reduce((acc, part) => {
        if (acc && typeof acc === 'object' && part in acc) {
          return acc[part];
        }
        return undefined;
      }, obj);
    }

    return function(data: PublicNoticePublicFrontEndResponse) {
      let dataValue = resolvePath(data, key);
      if (isNullish(dataValue)) {
        dataValue = null;
      }
      if (typeof dataValue === 'string') {
        dataValue = dataValue.toLowerCase();
      }
      if (comparFn.name === 'isDateOnOrAfter') {
        dataValue = DateTime.fromISO(dataValue as string).toJSDate(); // convert ISO date to js Date.
      }
      return comparFn(dataValue, filterValue);
    }
  }

}
