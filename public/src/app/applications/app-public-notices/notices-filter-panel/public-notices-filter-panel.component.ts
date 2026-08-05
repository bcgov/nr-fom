import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { IFilterFields } from '../../utils/filter';

@Component({
  imports: [
    NgTemplateOutlet,
    FormsModule,
    MatExpansionModule,
    BsDatepickerModule
  ],
  selector: 'notices-filter-panel',
  templateUrl: './public-notices-filter-panel.component.html',
  styleUrl: './public-notices-filter-panel.component.scss'
})
export class PublicNoticesFilterPanelComponent implements OnInit {

  filter: NoticeFilter;
  maxDate: Date = new Date();

  readonly districtList = input<string[] | undefined>(undefined);
  
  readonly filterPublicNoticesEvt = output<NoticeFilter>();

  ngOnInit(): void {
    this.filter = new NoticeFilter();
  }

  onFilterChange(): void {
    this.filterPublicNoticesEvt.emit(this.filter);
  }

}
export class NoticeFilter {
  forestClientName: IFilterFields<string> = { queryParam: 'forestClientName', value: null};
  districtName: IFilterFields<string> = { queryParam: 'districtName', value: null};
  commentingOpenDate: IFilterFields<Date> = { queryParam: 'commentingOpenDate', value: null};
}

