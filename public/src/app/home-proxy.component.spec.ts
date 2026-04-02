import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { HomeProxyComponent } from './home-proxy.component';

describe('HomeProxyComponent', () => {
  let component: HomeProxyComponent;
  let fixture: ComponentFixture<HomeProxyComponent>;
  let router: Router;

  describe('without showSplashModal param', () => {
    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [HomeProxyComponent, RouterTestingModule],
        providers: [
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: {
                paramMap: {
                  get: jest.fn().mockReturnValue(null),
                },
              },
            },
          },
        ],
      }).compileComponents();

      router = TestBed.inject(Router);
      jest.spyOn(router, 'navigate');
      fixture = TestBed.createComponent(HomeProxyComponent);
      component = fixture.componentInstance;
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should navigate to /projects without splash fragment', () => {
      fixture.detectChanges();
      expect(router.navigate).toHaveBeenCalledWith(['/projects']);
    });
  });

  describe('with showSplashModal=true param', () => {
    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [HomeProxyComponent, RouterTestingModule],
        providers: [
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: {
                paramMap: {
                  get: jest.fn().mockReturnValue('true'),
                },
              },
            },
          },
        ],
      }).compileComponents();

      router = TestBed.inject(Router);
      jest.spyOn(router, 'navigate');
      fixture = TestBed.createComponent(HomeProxyComponent);
      component = fixture.componentInstance;
    });

    it('should navigate to /projects with splash fragment when showSplashModal is true', () => {
      fixture.detectChanges();
      expect(router.navigate).toHaveBeenCalledWith(['/projects'], { fragment: 'splash' });
    });
  });
});
