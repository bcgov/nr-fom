import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FindPanelComponent } from './find-panel.component';

describe('FindPanelComponent', () => {
  let component: FindPanelComponent;
  let fixture: ComponentFixture<FindPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ FindPanelComponent ],
    }).compileComponents();
    fixture = TestBed.createComponent(FindPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Add more tests for logic, template, and events as needed
});
