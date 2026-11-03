import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Export } from './export';
import { DEFAULT_VIDEO_EXPORT_SETTINGS } from '../../../../models/video-export-settings.model';

describe('Export', () => {
  let component: Export;
  let fixture: ComponentFixture<Export>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Export],
    }).compileComponents();

    fixture = TestBed.createComponent(Export);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('videoSettings', { ...DEFAULT_VIDEO_EXPORT_SETTINGS });
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
