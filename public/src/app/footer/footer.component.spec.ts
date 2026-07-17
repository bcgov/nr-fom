import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { FooterComponent } from './footer.component';

@Component({ template: '' })
class StubComponent {}

describe('FooterComponent', () => {
  let component: FooterComponent;
  let fixture: ComponentFixture<FooterComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FooterComponent],
      providers: [
        provideRouter([
          { path: 'projects', component: StubComponent },
          { path: 'about', component: StubComponent },
        ]),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FooterComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should apply compact footer layout on projects routes', async () => {
    await router.navigateByUrl('/projects#splash');
    fixture.detectChanges();
    expect(component.isProjectsPage).toBe(true);
    expect(fixture.nativeElement.querySelector('footer').classList).toContain('app-footer--sm');
  });

  it('should not apply compact footer layout off projects routes', async () => {
    await router.navigateByUrl('/about');
    fixture.detectChanges();
    expect(component.isProjectsPage).toBe(false);
    expect(fixture.nativeElement.querySelector('footer').classList).not.toContain('app-footer--sm');
  });
});
