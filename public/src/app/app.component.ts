import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ModalService } from '@public-core/services/modal.service';
import { StateService } from '@public-core/services/state.service';
import { FooterComponent } from 'app/footer/footer.component';
import { HeaderComponent } from 'app/header/header.component';

@Component({
  standalone: true,
  imports: [
    RouterOutlet,
    HeaderComponent,
    FooterComponent
  ],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
    isReady$: Observable<boolean>;

  private ngUnsubscribe: Subject<void> = new Subject<void>();

  constructor(public router: Router, private stateSvc: StateService, private modalSvc: ModalService) {
  }

  async ngOnInit() {
    this.router.events.pipe(takeUntil(this.ngUnsubscribe)).subscribe(() => {
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    });

    try {
      const codeTables = await this.stateSvc.getCodeTables().toPromise();
      this.stateSvc.setCodeTables(codeTables);
      this.stateSvc.setReady();
      this.isReady$ = this.stateSvc.isReady$;
    }
    catch(err) {
      this.modalSvc.showFOMinitFailure();
      console.error(err);
    }
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
