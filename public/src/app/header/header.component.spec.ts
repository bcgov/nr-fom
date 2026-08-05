import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HeaderComponent } from './header.component';
import { ConfigService } from '@utility/services/config.service';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(async () => {
    mockConfigService = {
      getEnvironmentDisplay: jest.fn().mockReturnValue('Dev'),
    };

    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([]),
        { provide: ConfigService, useValue: mockConfigService },
        provideNoopAnimations(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should get environmentDisplay from ConfigService', () => {
    expect(component.environmentDisplay).toBe('Dev');
    expect(mockConfigService.getEnvironmentDisplay).toHaveBeenCalled();
  });

  it('should start with nav menu closed', () => {
    expect(component.isNavMenuOpen).toBe(false);
  });

  it('should toggle nav menu open on first toggle', () => {
    component.toggleNav();
    expect(component.isNavMenuOpen).toBe(true);
  });

  it('should toggle nav menu closed on second toggle', () => {
    component.toggleNav();
    component.toggleNav();
    expect(component.isNavMenuOpen).toBe(false);
  });

  it('should alternate nav state on repeated toggles', () => {
    component.toggleNav();
    expect(component.isNavMenuOpen).toBe(true);
    component.toggleNav();
    expect(component.isNavMenuOpen).toBe(false);
    component.toggleNav();
    expect(component.isNavMenuOpen).toBe(true);
  });

  it('should have router injected', () => {
    expect(component.router).toBeDefined();
  });

  it('showAllFoms navigates to /projects with reload + resetMap state (so the map resets even when already there)', () => {
    const navSpy = jest.spyOn(component.router, 'navigate').mockResolvedValue(true);
    component.showAllFoms();
    expect(navSpy).toHaveBeenCalledWith(['/projects'], { onSameUrlNavigation: 'reload', state: { resetMap: true } });
  });

  it('showHome (brand) navigates to /projects#splash with reload + resetMap state', () => {
    const navSpy = jest.spyOn(component.router, 'navigate').mockResolvedValue(true);
    component.showHome();
    expect(navSpy).toHaveBeenCalledWith(['/projects'], {
      fragment: 'splash',
      onSameUrlNavigation: 'reload',
      state: { resetMap: true },
    });
  });
});
