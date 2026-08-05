import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { UploadBoxComponent } from './file-upload-box.component';

const BYTES_PER_MB = 1048576;

function makeFile(name: string, type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe('UploadBoxComponent', () => {
  let fixture: ComponentFixture<UploadBoxComponent>;
  let component: UploadBoxComponent;
  let emitted: (File | null)[];

  function setup(inputs: { maxFileSizeMB?: number; fileTypes?: string[] } = {}) {
    TestBed.configureTestingModule({
      imports: [UploadBoxComponent, NoopAnimationsModule],
    });
    fixture = TestBed.createComponent(UploadBoxComponent);
    component = fixture.componentInstance;
    if (inputs.maxFileSizeMB !== undefined) {
      fixture.componentRef.setInput('maxFileSizeMB', inputs.maxFileSizeMB);
    }
    if (inputs.fileTypes) {
      fixture.componentRef.setInput('fileTypes', inputs.fileTypes);
    }
    emitted = [];
    component.emitFile.subscribe((f) => emitted.push(f));
    fixture.detectChanges();
  }

  // Simulate the @ngx-dropzone directive writing the selected file into the bound signal-forms field.
  function select(file: File | null) {
    component.fileForm.file().value.set(file);
    fixture.detectChanges();
  }

  it('creates', () => {
    setup();
    expect(component).toBeTruthy();
  });

  it('does not emit on init (an init emit(null) would trigger the parent error dialog)', () => {
    setup();
    expect(emitted).toEqual([]);
  });

  it('emits the file when a valid file is selected', () => {
    setup({ fileTypes: ['text/plain'], maxFileSizeMB: 1 });
    const file = makeFile('a.txt', 'text/plain', 100);
    select(file);

    expect(component.selectedFile()).toBe(file);
    expect(component.acceptError()).toBe(false);
    expect(component.maxSizeError()).toBe(false);
    expect(emitted).toEqual([file]);
  });

  it('flags an unaccepted file type and emits null', () => {
    setup({ fileTypes: ['text/plain'] });
    select(makeFile('a.png', 'image/png', 100));

    expect(component.acceptError()).toBe(true);
    expect(emitted).toEqual([null]);
  });

  it('flags an oversize file and emits null', () => {
    setup({ fileTypes: ['text/plain'], maxFileSizeMB: 1 });
    select(makeFile('big.txt', 'text/plain', 2 * BYTES_PER_MB));

    expect(component.maxSizeError()).toBe(true);
    expect(emitted).toEqual([null]);
  });

  it('defaults to a 10 MB limit when maxFileSizeMB is not provided', () => {
    setup({ fileTypes: ['text/plain'] });
    expect(component.maxFileSize()).toBe(10 * BYTES_PER_MB);

    select(makeFile('big.txt', 'text/plain', 11 * BYTES_PER_MB));
    expect(component.maxSizeError()).toBe(true);
  });

  it('clear() resets the selection and emits null', () => {
    setup({ fileTypes: ['text/plain'] });
    select(makeFile('a.txt', 'text/plain', 10));
    emitted.length = 0;

    component.clear();
    fixture.detectChanges();

    expect(component.selectedFile()).toBeNull();
    expect(emitted).toEqual([null]);
  });
});
