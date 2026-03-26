import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DetailsMapComponent } from './details-map.component';

describe('DetailsMapComponent', () => {
  let component: DetailsMapComponent;
  let fixture: ComponentFixture<DetailsMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DetailsMapComponent ],
    }).compileComponents();
    fixture = TestBed.createComponent(DetailsMapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Add more tests for logic, template, and events as needed
});
