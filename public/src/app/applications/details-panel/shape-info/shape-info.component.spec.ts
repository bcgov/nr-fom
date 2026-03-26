import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShapeInfoComponent } from './shape-info.component';

describe('ShapeInfoComponent', () => {
  let component: ShapeInfoComponent;
  let fixture: ComponentFixture<ShapeInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ShapeInfoComponent ],
    }).compileComponents();
    fixture = TestBed.createComponent(ShapeInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Add more tests for logic, template, and events as needed
});
