import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MaskEditor } from './mask-editor';

describe('MaskEditor', () => {
  let component: MaskEditor;
  let fixture: ComponentFixture<MaskEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaskEditor],
    }).compileComponents();

    fixture = TestBed.createComponent(MaskEditor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
