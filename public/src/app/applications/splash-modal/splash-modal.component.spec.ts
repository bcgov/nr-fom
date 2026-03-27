import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { SplashModalComponent, SplashModalResult } from './splash-modal.component';
import { UrlService } from '@public-core/services/url.service';

describe('SplashModalComponent', () => {
  let component: SplashModalComponent;
  let fixture: ComponentFixture<SplashModalComponent>;
  let mockActiveModal: Partial<NgbActiveModal>;
  let mockUrlService: Partial<UrlService>;
  let router: Router;

  beforeEach(async () => {
    mockActiveModal = {
      close: jest.fn(),
    };

    mockUrlService = {
      setFragment: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [SplashModalComponent, RouterTestingModule],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: UrlService, useValue: mockUrlService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {},
          },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate');

    fixture = TestBed.createComponent(SplashModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have faArrowUpRightFromSquare icon', () => {
    expect(component.faArrowUpRightFromSquare).toBeDefined();
  });

  describe('dismiss', () => {
    it('should close modal with Dismissed result', () => {
      component.dismiss();
      expect(mockActiveModal.close).toHaveBeenCalledWith(SplashModalResult.Dismissed);
    });

    it('should clear url fragment', () => {
      component.dismiss();
      expect(mockUrlService.setFragment).toHaveBeenCalledWith(null);
    });
  });

  describe('explore', () => {
    it('should close modal with Exploring result', () => {
      component.explore();
      expect(mockActiveModal.close).toHaveBeenCalledWith(SplashModalResult.Exploring);
    });

    it('should navigate to find fragment', () => {
      component.explore();
      expect(router.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ fragment: 'find', replaceUrl: true })
      );
    });
  });
});
