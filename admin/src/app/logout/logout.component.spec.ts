import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LogoutComponent } from './logout.component';

describe('LogoutComponent', () => {
  let fixture: ComponentFixture<LogoutComponent>;
  let component: LogoutComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LogoutComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(LogoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('tells the user they are logged out', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Logged Out');
    expect(text).toContain('You have been logged out.');
  });

  // The component must not depend on a session: it renders at the end of the logout
  // chain, when there is none. Constructing it with no providers proves that.
  it('renders with no injected dependencies', () => {
    expect(component).toBeTruthy();
  });

  it('offers a log in button wired to login()', () => {
    const loginSpy = jest.spyOn(component, 'login').mockImplementation(() => undefined);
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');

    expect(button.textContent).toContain('Log in');
    button.click();

    expect(loginSpy).toHaveBeenCalledTimes(1);
  });
});
