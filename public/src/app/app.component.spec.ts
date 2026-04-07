import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { AppComponent } from './app.component';
import { StateService } from '@public-core/services/state.service';
import { ModalService } from '@public-core/services/modal.service';

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let mockStateService: Partial<StateService>;
  let mockModalService: Partial<ModalService>;

  beforeEach(async () => {
    mockStateService = {
      getCodeTables: jest.fn().mockReturnValue(of({
        responseCode: [],
        district: [],
        workflowStateCode: [],
      })),
      setCodeTables: jest.fn(),
      setReady: jest.fn(),
      isReady$: new BehaviorSubject<boolean>(false).asObservable(),
    };

    mockModalService = {
      showFOMinitFailure: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: StateService, useValue: mockStateService },
        { provide: ModalService, useValue: mockModalService },
        provideNoopAnimations(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call getCodeTables on init', async () => {
    await component.ngOnInit();
    expect(mockStateService.getCodeTables).toHaveBeenCalled();
  });

  it('should set code tables after fetching', async () => {
    const mockCodeTables = { responseCode: [], district: [], workflowStateCode: [] };
    (mockStateService.getCodeTables as jest.Mock).mockReturnValue(of(mockCodeTables));
    await component.ngOnInit();
    expect(mockStateService.setCodeTables).toHaveBeenCalledWith(mockCodeTables);
  });

  it('should call setReady after loading code tables', async () => {
    await component.ngOnInit();
    expect(mockStateService.setReady).toHaveBeenCalled();
  });

  it('should show modal on init failure', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (mockStateService.getCodeTables as jest.Mock).mockReturnValue(
      throwError(() => new Error('init failed'))
    );
    await component.ngOnInit();
    expect(mockModalService.showFOMinitFailure).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should unsubscribe on destroy', () => {
    const nextSpy = jest.spyOn(component['ngUnsubscribe'], 'next');
    const completeSpy = jest.spyOn(component['ngUnsubscribe'], 'complete');
    component.ngOnDestroy();
    expect(nextSpy).toHaveBeenCalled();
    expect(completeSpy).toHaveBeenCalled();
  });

  it('should have header and footer components in template', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement;
    expect(el.querySelector('app-header')).toBeTruthy();
    expect(el.querySelector('app-footer')).toBeTruthy();
  });

  it('should have router-outlet', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement;
    expect(el.querySelector('router-outlet')).toBeTruthy();
  });
});
