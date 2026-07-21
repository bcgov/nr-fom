import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterOutlet } from '@angular/router';
import { Observable } from 'rxjs';

import { ModalService } from '@public-core/services/modal.service';
import { StateService } from '@public-core/services/state.service';
import { FooterComponent } from 'app/footer/footer.component';
import { HeaderComponent } from 'app/header/header.component';

@Component({
  imports: [
    RouterOutlet,
    HeaderComponent,
    FooterComponent
  ],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
    router = inject(Router);
    private stateSvc = inject(StateService);
    private modalSvc = inject(ModalService);
    private destroyRef = inject(DestroyRef);

    isReady$: Observable<boolean>;

  async ngOnInit() {
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
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
}
