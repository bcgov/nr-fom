import { NgClass, NgFor } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { PublicCommentAdminResponse } from '@api-client';

interface StatusStat {
  label: string;
  count: number;
  colorClass: string;
  filterValue: string;
}

@Component({
  standalone: true,
  imports: [ NgFor, NgClass ],
  selector: 'app-progress-dashboard',
  templateUrl: './progress-dashboard.component.html',
  styleUrls: [ './progress-dashboard.component.scss' ]
})
export class ProgressDashboardComponent implements OnChanges {
  @Output() filterByStatus = new EventEmitter<string>();
  @Input() comments: PublicCommentAdminResponse[] = [];

  total = 0;
  actioned = 0;
  completionPct = 0;
  stats: StatusStat[] = [];

  ngOnChanges(): void {
    const total = this.comments.length;
    const considered = this.comments.filter(c => c.response?.code === 'CONSIDERED').length;
    const addressed = this.comments.filter(c => c.response?.code === 'ADDRESSED').length;
    const notApplicable = this.comments.filter(c => c.response?.code === 'IRRELEVANT').length;
    const unactioned = total - considered - addressed - notApplicable;
    const actioned = considered + addressed + notApplicable;

    this.total = total;
    this.actioned = actioned;
    this.completionPct = total > 0 ? Math.round((actioned / total) * 100) : 0;

    this.stats = [
      { label: 'Total', count: total, colorClass: 'stat--total', filterValue: 'ALL' },
      { label: 'Considered', count: considered, colorClass: 'stat--considered', filterValue: 'CONSIDERED' },
      { label: 'Addressed', count: addressed, colorClass: 'stat--addressed', filterValue: 'ADDRESSED' },
      { label: 'Not Applicable', count: notApplicable, colorClass: 'stat--not-applicable', filterValue: 'IRRELEVANT' },
      { label: 'Unactioned', count: unactioned, colorClass: 'stat--unactioned', filterValue: 'UNACTIONED' },
    ];
  }
}
