import { DatePipe, NgIf } from '@angular/common';
import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ProjectCommentingClosedDateChangeRequest, ProjectService } from '@api-client';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import * as moment from 'moment';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';

@Component({
    standalone: true,
    imports: [
        NgIf, 
        MatProgressBarModule, 
        FormsModule, 
        BsDatepickerModule, 
        DatePipe
    ],
    templateUrl: './enddate-change-modal.component.html',
    styleUrls: ['./enddate-change-modal.component.scss'],
    encapsulation: ViewEncapsulation.None // Important to make bootstrap modal custom styling property 'windowClass' work.
})
export class EnddateChangeModalComponent implements OnInit {

  public updating = false;
  public changeRequest = {} as ProjectCommentingClosedDateChangeRequest; // Default values assigned when modal compoent was opened outside.
  public projectId: number;
  public currentCommentingClosedDate: string;
  public newCommentingClosedDate: Date;
  public minDate: Date;

  constructor(
    private activeModal: NgbActiveModal,
    private projectService: ProjectService
  ) {}

  ngOnInit(): void {
    this.minDate = moment().add(1, 'days').toDate(); // Earliest date allowed for change: tomorrow.
    this.newCommentingClosedDate = this.minDate;
  }

  public changeEndDate() {
    this.updating = true;

    this.changeRequest.commentingClosedDate = moment(this.newCommentingClosedDate).format('YYYY-MM-DD');
    this.projectService.projectControllerCommentingClosedDateChange(this.projectId, this.changeRequest)
        .toPromise()
        .then(() => {
          this.updating = false;
          // Close and pass message {reason, projectUpdated}
          this.activeModal.close({reason: 'Commenting End Date updated successfully.', projectUpdated: true});
        })
        .catch((err) => {
          console.error(err)
          this.updating = false;
          this.dismiss('Commenting End Date updated failed.');
        });
  }

  public dismiss(reason: string) {
    this.activeModal.dismiss(reason);
  }

}
