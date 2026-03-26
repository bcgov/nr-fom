import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PublicNoticesFilterPanelComponent } from './public-notices-filter-panel.component';

describe('PublicNoticesFilterPanelComponent', () => {
  let component: PublicNoticesFilterPanelComponent;
  let fixture: ComponentFixture<PublicNoticesFilterPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PublicNoticesFilterPanelComponent ],
    }).compileComponents();
    fixture = TestBed.createComponent(PublicNoticesFilterPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Add more tests for logic, template, and events as needed
});
