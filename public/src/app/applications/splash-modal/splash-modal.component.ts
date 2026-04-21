import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap/modal';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { UrlService } from '@public-core/services/url.service';


export enum SplashModalResult {
  Dismissed,
  Finding,
  Exploring
}

@Component({
  standalone: true,
  imports: [FontAwesomeModule],
  templateUrl: './splash-modal.component.html',
  styleUrls: ['./splash-modal.component.scss']
})
export class SplashModalComponent {
  public faArrowUpRightFromSquare = faArrowUpRightFromSquare;

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private urlSvc: UrlService,    
    public activeModal: NgbActiveModal // also used in template
  ) {}

  public dismiss() {
    this.activeModal.close(SplashModalResult.Dismissed);
    this.urlSvc.setFragment(null);
  }

  public explore() {
    this.activeModal.close(SplashModalResult.Exploring);
    // open Find panel (but don't set URL parameters)
    this.router.navigate([], { relativeTo: this.activatedRoute, fragment: 'find', replaceUrl: true });
  }
}
