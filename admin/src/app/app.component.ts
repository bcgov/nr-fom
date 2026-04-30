import { AsyncPipe, NgIf } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Observable, lastValueFrom } from 'rxjs';
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
    this.isReady$ = this.stateSvc.isReady$;
  }

  async ngOnInit() {
    try {
      const codeTables = await lastValueFrom(this.stateSvc.getCodeTables());
      this.stateSvc.setCodeTables(codeTables);
    } catch (error) {
      console.error('Failed to load code tables:', error);
    }
    this.stateSvc.setReady();
  }
}