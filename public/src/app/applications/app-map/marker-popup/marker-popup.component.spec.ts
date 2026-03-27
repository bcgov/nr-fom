import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarkerPopupComponent } from './marker-popup.component';
import { StateService } from '@public-core/services/state.service';
import { UrlService } from '@public-core/services/url.service';
import { Panel } from '../../../applications/utils/panel.enum';

describe('MarkerPopupComponent', () => {
  let component: MarkerPopupComponent;
  let fixture: ComponentFixture<MarkerPopupComponent>;
  let mockStateService: Partial<StateService>;
  let mockUrlService: Partial<UrlService>;

  beforeEach(async () => {
    mockStateService = {
      getCodeTable: jest.fn().mockReturnValue([
        { code: 'INITIAL', description: 'Initial' },
        { code: 'PUBLISHED', description: 'Published' },
        { code: 'FINALIZED', description: 'Finalized' },
      ]),
    };

    mockUrlService = {
      setQueryParam: jest.fn(),
      setFragment: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [MarkerPopupComponent],
      providers: [
        { provide: StateService, useValue: mockStateService },
        { provide: UrlService, useValue: mockUrlService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(MarkerPopupComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should get workflow status from state service', () => {
    fixture.detectChanges();
    expect(mockStateService.getCodeTable).toHaveBeenCalledWith('workflowStateCode');
  });

  it('should index workflow status by code', () => {
    fixture.detectChanges();
    expect(component.workflowStatus['INITIAL']).toBeDefined();
    expect(component.workflowStatus['INITIAL'].description).toBe('Initial');
    expect(component.workflowStatus['PUBLISHED']).toBeDefined();
    expect(component.workflowStatus['FINALIZED']).toBeDefined();
  });

  describe('showDetails', () => {
    beforeEach(() => {
      component.projectSummary = {
        id: 42,
        name: 'Test Project',
      } as any;
    });

    it('should set query param with project id', () => {
      component.showDetails();
      expect(mockUrlService.setQueryParam).toHaveBeenCalledWith('id', '42');
    });

    it('should set fragment to details panel', () => {
      component.showDetails();
      expect(mockUrlService.setFragment).toHaveBeenCalledWith(Panel.details);
    });
  });
});
