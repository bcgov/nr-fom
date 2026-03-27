import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { PublicNoticesPanelComponent } from './public-notices-panel.component';
import { PublicNoticeService } from '@api-client';
import { UrlService } from '@public-core/services/url.service';
import { Panel } from '../utils/panel.enum';

describe('PublicNoticesPanelComponent', () => {
  let component: PublicNoticesPanelComponent;
  let fixture: ComponentFixture<PublicNoticesPanelComponent>;
  let mockPublicNoticeService: Partial<PublicNoticeService>;
  let mockUrlService: Partial<UrlService>;

  const mockNotices = [
    {
      id: 1,
      project: {
        id: 10,
        forestClient: { name: 'Client A' },
        commentingOpenDate: '2025-01-01',
        district: { name: 'District 1' },
      },
    },
    {
      id: 2,
      project: {
        id: 20,
        forestClient: { name: 'Client B' },
        commentingOpenDate: '2025-02-01',
        district: { name: 'District 2' },
      },
    },
  ];

  beforeEach(async () => {
    mockPublicNoticeService = {
      publicNoticeControllerFindListForPublicFrontEnd: jest.fn().mockReturnValue(of(mockNotices)),
    };

    mockUrlService = {
      setQueryParam: jest.fn(),
      setFragment: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [PublicNoticesPanelComponent, RouterTestingModule],
      providers: [
        { provide: PublicNoticeService, useValue: mockPublicNoticeService },
        { provide: UrlService, useValue: mockUrlService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PublicNoticesPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should fetch public notices on init', () => {
    expect(mockPublicNoticeService.publicNoticeControllerFindListForPublicFrontEnd).toHaveBeenCalled();
  });

  it('should populate pNotices from service response', () => {
    expect(component.pNotices).toBeDefined();
    expect(component.pNotices.length).toBe(2);
  });

  it('should populate initialPNotices from service response', () => {
    expect(component.initialPNotices).toBeDefined();
    expect(component.initialPNotices.length).toBe(2);
  });

  it('should build districtList from notices', () => {
    expect(component.districtList).toBeDefined();
    expect(component.districtList).toContain('District 1');
    expect(component.districtList).toContain('District 2');
    // Should be sorted
    expect(component.districtList[0]).toBe('District 1');
  });

  it('should start with isLoading false', () => {
    expect(component.isLoading).toBe(false);
  });

  describe('showDetails', () => {
    it('should emit update with hidePanel true', () => {
      const emitSpy = jest.spyOn(component.update, 'emit');
      jest.useFakeTimers();
      component.showDetails(42);
      expect(emitSpy).toHaveBeenCalledWith({ search: false, resetMap: false, hidePanel: true });
      jest.useRealTimers();
    });

    it('should set query param and fragment after delay', () => {
      jest.useFakeTimers();
      component.showDetails(42);
      jest.advanceTimersByTime(500);
      expect(mockUrlService.setQueryParam).toHaveBeenCalledWith('id', '42');
      expect(mockUrlService.setFragment).toHaveBeenCalledWith(Panel.details);
      jest.useRealTimers();
    });
  });

  describe('handlePublicNoticesFilterUpdate', () => {
    it('should filter notices by forest client name', () => {
      component.handlePublicNoticesFilterUpdate({
        forestClientName: { queryParam: 'fc', value: 'Client A' },
        districtName: { queryParam: 'dn', value: null },
        commentingOpenDate: { queryParam: 'cod', value: null },
      } as any);
      expect(component.pNotices.length).toBe(1);
      expect(component.pNotices[0].project.forestClient.name).toBe('Client A');
    });

    it('should filter notices by district name', () => {
      component.handlePublicNoticesFilterUpdate({
        forestClientName: { queryParam: 'fc', value: null },
        districtName: { queryParam: 'dn', value: 'District 2' },
        commentingOpenDate: { queryParam: 'cod', value: null },
      } as any);
      expect(component.pNotices.length).toBe(1);
      expect(component.pNotices[0].project.district.name).toBe('District 2');
    });

    it('should return all notices when no filter values set', () => {
      component.handlePublicNoticesFilterUpdate({
        forestClientName: { queryParam: 'fc', value: null },
        districtName: { queryParam: 'dn', value: null },
        commentingOpenDate: { queryParam: 'cod', value: null },
      } as any);
      expect(component.pNotices.length).toBe(2);
    });
  });

  describe('isFomAvailable', () => {
    it('should return true for past date', () => {
      const result = component.isFomAvailable('2020-01-01');
      expect(result).toBe(true);
    });
  });
});
