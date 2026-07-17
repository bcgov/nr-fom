import { DatePipe } from '@angular/common';
import { Component, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ProjectCommentingClosedDateChangeRequest, ProjectService } from '@api-client';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { DateTime } from 'luxon';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';

@Component({
    standalone: true,
    imports: [
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
  private activeModal = inject(NgbActiveModal);
  private projectService = inject(ProjectService);


  public updating = false;
  public changeRequest = {} as ProjectCommentingClosedDateChangeRequest; // Default values assigned when modal compoent was opened outside.
  public projectId: number;
  public currentCommentingClosedDate: string;
  public newCommentingClosedDate: Date;
  public minDate: Date;

  ngOnInit(): void {
    this.minDate = DateTime.now().plus({days: 1}).toJSDate(); // Earliest date allowed for change: tomorrow.
    this.newCommentingClosedDate = this.minDate;
  }

  public changeEndDate() {
    this.updating = true;

    this.changeRequest.commentingClosedDate = DateTime.fromJSDate(this.newCommentingClosedDate).toISODate();
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
