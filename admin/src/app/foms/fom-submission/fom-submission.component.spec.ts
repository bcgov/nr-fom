import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FomSubmissionComponent } from './fom-submission.component';
import { CognitoService } from '@admin-core/services/cognito.service';
import { ModalService } from '@admin-core/services/modal.service';
import { StateService } from '@admin-core/services/state.service';
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
        { provide: StateService, useValue: { loading: false } },
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
});
