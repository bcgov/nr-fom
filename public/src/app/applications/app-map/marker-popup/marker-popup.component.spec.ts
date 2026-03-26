import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarkerPopupComponent } from './marker-popup.component';

describe('MarkerPopupComponent', () => {
  let component: MarkerPopupComponent;
  let fixture: ComponentFixture<MarkerPopupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MarkerPopupComponent ],
    }).compileComponents();
    fixture = TestBed.createComponent(MarkerPopupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Add more tests for logic, template, and events as needed
});
