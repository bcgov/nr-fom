import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { PublicNoticesFilterPanelComponent, NoticeFilter } from './public-notices-filter-panel.component';

describe('PublicNoticesFilterPanelComponent', () => {
  let component: PublicNoticesFilterPanelComponent;
  let fixture: ComponentFixture<PublicNoticesFilterPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicNoticesFilterPanelComponent, FormsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(PublicNoticesFilterPanelComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize filter on ngOnInit', () => {
    component.ngOnInit();
    expect(component.filter).toBeDefined();
    expect(component.filter).toBeInstanceOf(NoticeFilter);
  });

  it('should initialize filter with null values', () => {
    component.ngOnInit();
    expect(component.filter.forestClientName.value).toBeNull();
    expect(component.filter.districtName.value).toBeNull();
    expect(component.filter.commentingOpenDate.value).toBeNull();
  });

  it('should have maxDate set to today', () => {
    const today = new Date();
    expect(component.maxDate.getFullYear()).toBe(today.getFullYear());
    expect(component.maxDate.getMonth()).toBe(today.getMonth());
    expect(component.maxDate.getDate()).toBe(today.getDate());
  });

  describe('onFilterChange', () => {
    it('should emit filterPublicNoticesEvt', () => {
      component.ngOnInit();
      const emitSpy = jest.spyOn(component.filterPublicNoticesEvt, 'emit');
      component.onFilterChange();
      expect(emitSpy).toHaveBeenCalledWith(component.filter);
    });
  });

  describe('districtList input', () => {
    it('should accept districtList input', () => {
      component.districtList = ['District A', 'District B'];
      expect(component.districtList.length).toBe(2);
      expect(component.districtList).toContain('District A');
    });
  });
});

describe('NoticeFilter', () => {
  it('should have forestClientName field', () => {
    const filter = new NoticeFilter();
    expect(filter.forestClientName).toBeDefined();
    expect(filter.forestClientName.queryParam).toBe('forestClientName');
    expect(filter.forestClientName.value).toBeNull();
  });

  it('should have districtName field', () => {
    const filter = new NoticeFilter();
    expect(filter.districtName).toBeDefined();
    expect(filter.districtName.queryParam).toBe('districtName');
    expect(filter.districtName.value).toBeNull();
  });

  it('should have commentingOpenDate field', () => {
    const filter = new NoticeFilter();
    expect(filter.commentingOpenDate).toBeDefined();
    expect(filter.commentingOpenDate.queryParam).toBe('commentingOpenDate');
    expect(filter.commentingOpenDate.value).toBeNull();
  });
});
