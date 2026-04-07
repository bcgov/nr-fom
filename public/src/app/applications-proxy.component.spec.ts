import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute, provideRouter } from '@angular/router';
import { ApplicationsProxyComponent } from './applications-proxy.component';

describe('ApplicationsProxyComponent', () => {
  let component: ApplicationsProxyComponent;
  let fixture: ComponentFixture<ApplicationsProxyComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApplicationsProxyComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              params: { id: '123' },
            },
          },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate');
    fixture = TestBed.createComponent(ApplicationsProxyComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should navigate to /applications with id query param and details fragment', () => {
    fixture.detectChanges();
    expect(router.navigate).toHaveBeenCalledWith(
      ['/applications'],
      { queryParams: { id: '123' }, fragment: 'details' }
    );
  });

  it('should pass route id to query params', () => {
    fixture.detectChanges();
    const navigateCall = (router.navigate as jest.Mock).mock.calls[0];
    expect(navigateCall[1].queryParams.id).toBe('123');
    expect(navigateCall[1].fragment).toBe('details');
  });
});
