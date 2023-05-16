import { AsyncPipe, NgIf } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Observable } from 'rxjs';
import { StateService } from '@admin-core/services/state.service';
import { FooterComponent } from './footer/footer.component';
import { HeaderComponent } from './header/header.component';

@Component({
    standalone: true,
    imports: [
        NgIf, 
        HeaderComponent, 
        RouterOutlet, 
        FooterComponent, 
        AsyncPipe
    ],
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  isReady$: Observable<boolean>;

  constructor(private stateSvc: StateService) {
  }

  async ngOnInit() {
    const codeTables = await this.stateSvc.getCodeTables().toPromise();
    this.stateSvc.setCodeTables(codeTables);
    this.stateSvc.setReady();
    this.isReady$ = this.stateSvc.isReady$;
  }
}