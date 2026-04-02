import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AboutComponent } from './about.component';
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';

describe('AboutComponent', () => {
  let component: AboutComponent;
  let fixture: ComponentFixture<AboutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AboutComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(AboutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have faArrowUpRightFromSquare icon defined', () => {
    expect(component.faArrowUpRightFromSquare).toBeDefined();
    expect(component.faArrowUpRightFromSquare).toBe(faArrowUpRightFromSquare);
  });

  it('should have icon with expected properties', () => {
    const icon = component.faArrowUpRightFromSquare;
    expect(icon.iconName).toBe('arrow-up-right-from-square');
    expect(icon.prefix).toBe('fas');
  });

  it('should render the about template', () => {
    const el = fixture.nativeElement;
    expect(el).toBeTruthy();
  });
});
