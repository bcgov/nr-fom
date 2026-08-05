import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FomSubmissionComponent } from './fom-submission.component';
import { CognitoService } from '@admin-core/services/cognito.service';
import { ModalService } from '@admin-core/services/modal.service';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RxFormBuilder } from '@rxweb/reactive-form-validators';
import { ProjectService, SubmissionService } from '@api-client';
import { of } from 'rxjs';

describe('FomSubmissionComponent', () => {
  let component: FomSubmissionComponent;
  let fixture: ComponentFixture<FomSubmissionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        FomSubmissionComponent,
        NoopAnimationsModule,
      ],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { params: { appId: '1' } },
            url: of([]),
          },
        },
        { provide: ProjectService, useValue: { projectControllerFindOne: jest.fn().mockReturnValue(of({})) } },
        { provide: SubmissionService, useValue: { submissionControllerFindSubmissionDetailForCurrentSubmissionType: jest.fn().mockReturnValue(of({})) } },
        { provide: ModalService, useValue: { openErrorDialog: jest.fn(), openConfirmationDialog: jest.fn() } },
        { provide: CognitoService, useValue: { getUser: jest.fn().mockReturnValue({ isAuthorizedForClientId: jest.fn() }) } },
        { provide: RxFormBuilder, useValue: { formGroup: jest.fn().mockReturnValue({ get: jest.fn().mockReturnValue({ setValue: jest.fn() }), value: {} }) } },
        { provide: MatSnackBar, useValue: { open: jest.fn(), dismiss: jest.fn() } },
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(FomSubmissionComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('populates project()/spatialSubmission() signals from the load (replaces the ngOnInit cdr)', () => {
    const projectResponse = {
      id: 5,
      workflowState: { code: 'INITIAL' },
      forestClient: { id: 'c1' },
      projectPlanCode: 'FSP',
      fspId: 5,
      woodlotLicenseNumber: null,
    };
    const spatial = { submissionId: 9, cutblocks: { count: 0 }, roadSections: { count: 0 }, retentionAreas: { count: 0 } };
    (TestBed.inject(ProjectService).projectControllerFindOne as jest.Mock).mockReturnValue(of(projectResponse));
    (TestBed.inject(SubmissionService).submissionControllerFindSubmissionDetailForCurrentSubmissionType as jest.Mock)
      .mockReturnValue(of(spatial));

    fixture.componentRef.setInput('appId', '5');
    component.ngOnInit(); // the load (sync `of(...)`) sets the signals — no cdr, no template render needed

    expect(component.project()).toEqual(projectResponse);
    expect(component.spatialSubmission()).toEqual(spatial);
    // The `@if (fg())` gate MUST be a signal so the load triggers zoneless CD and renders the form.
    // (A blank page resulted when it was a plain field: signals read only inside a collapsed @if have
    //  no consumer to schedule CD.) NOTE: rendering itself can't be asserted here — the fake
    //  RxFormBuilder can't back a real [formGroup]; the render path is covered by manual/e2e checks.
    expect(component.fg()).toBeTruthy();
  });
});
