import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HomeProxyComponent } from './home-proxy.component';

describe('HomeProxyComponent', () => {
  let component: HomeProxyComponent;
  let fixture: ComponentFixture<HomeProxyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ HomeProxyComponent ],
    }).compileComponents();
    fixture = TestBed.createComponent(HomeProxyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Add more tests for home proxy logic, template, and events as needed
});
