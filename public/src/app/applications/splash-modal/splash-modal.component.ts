import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { UrlService } from '@public-core/services/url.service';


export enum SplashModalResult {
  Dismissed,
  Finding,
  Exploring
}

@Component({
  imports: [FontAwesomeModule],
  templateUrl: './splash-modal.component.html',
  styleUrl: './splash-modal.component.scss'
})
export class SplashModalComponent {
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private urlSvc = inject(UrlService);
  activeModal = inject(NgbActiveModal);

  public faArrowUpRightFromSquare = faArrowUpRightFromSquare;

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
