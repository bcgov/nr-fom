import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DateInputComponent } from './date-input.component';

describe('DateInputComponent', () => {
  let component: DateInputComponent;
  let fixture: ComponentFixture<DateInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DateInputComponent],
    })
      .overrideComponent(DateInputComponent, {
        set: { template: '<div></div>', styles: [] },
      })
      .compileComponents();
    fixture = TestBed.createComponent(DateInputComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with null ngbDate', () => {
    expect(component.ngbDate).toBeNull();
  });

  it('should convert Date to NgbDateStruct on ngOnChanges', () => {
    const testDate = new Date(2023, 5, 15);
    component.date = testDate;
    component.ngOnChanges({ date: { currentValue: testDate, previousValue: null, firstChange: true, isFirstChange: () => true } });
    expect(component.ngbDate).toEqual({ year: 2023, month: 6, day: 15 });
  });

  it('should convert null Date to null NgbDateStruct', () => {
    component.date = null;
    component.ngOnChanges({ date: { currentValue: null, previousValue: new Date(), firstChange: false, isFirstChange: () => false } });
    expect(component.ngbDate).toBeNull();
  });

  it('should convert minDate on ngOnChanges', () => {
    const minDate = new Date(2020, 0, 1);
    component.minDate = minDate;
    component.ngOnChanges({ minDate: { currentValue: minDate, previousValue: null, firstChange: true, isFirstChange: () => true } });
    expect(component.minNgbDate).toEqual({ year: 2020, month: 1, day: 1 });
  });

  it('should convert maxDate on ngOnChanges', () => {
    const maxDate = new Date(2025, 11, 31);
    component.maxDate = maxDate;
    component.ngOnChanges({ maxDate: { currentValue: maxDate, previousValue: null, firstChange: true, isFirstChange: () => true } });
    expect(component.maxNgbDate).toEqual({ year: 2025, month: 12, day: 31 });
  });

  it('should validate valid date', () => {
    expect(component.isValidDate({ year: 2023, month: 6, day: 15 })).toBe(true);
  });

  it('should invalidate null date', () => {
    expect(component.isValidDate(null)).toBeFalsy();
  });

  it('should invalidate date with NaN values', () => {
    expect(component.isValidDate({ year: NaN, month: 1, day: 1 })).toBe(false);
    expect(component.isValidDate({ year: 2023, month: NaN, day: 1 })).toBe(false);
    expect(component.isValidDate({ year: 2023, month: 1, day: NaN })).toBe(false);
  });

  it('should emit dateChange on onDateChg', () => {
    const emitSpy = jest.spyOn(component.dateChange, 'emit');
    component.ngbDate = { year: 2023, month: 6, day: 15 };
    component.onDateChg(component.ngbDate);
    expect(emitSpy).toHaveBeenCalled();
    const emitted = emitSpy.mock.calls[0][0];
    expect(emitted.getFullYear()).toBe(2023);
    expect(emitted.getMonth()).toBe(5);
    expect(emitted.getDate()).toBe(15);
  });

  it('should emit null on onDateChg with null date', () => {
    const emitSpy = jest.spyOn(component.dateChange, 'emit');
    component.onDateChg(null);
    expect(emitSpy).toHaveBeenCalledWith(null);
  });

  it('should clear date and emit null', () => {
    const emitSpy = jest.spyOn(component.dateChange, 'emit');
    component.ngbDate = { year: 2023, month: 6, day: 15 };
    component.clearDate();
    expect(component.ngbDate).toBeNull();
    expect(emitSpy).toHaveBeenCalledWith(null);
  });

  it('should have default isValidate as false', () => {
    expect(component.isValidate).toBe(false);
  });

  it('should have dateChange EventEmitter', () => {
    expect(component.dateChange).toBeDefined();
  });
});
