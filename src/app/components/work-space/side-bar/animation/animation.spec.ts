import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Animation } from './animation';
import { DEFAULT_VIDEO_EXPORT_SETTINGS } from '../../../../models/video-export-settings.model';

describe('Animation', () => {
  let component: Animation;
  let fixture: ComponentFixture<Animation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Animation],
    }).compileComponents();

    fixture = TestBed.createComponent(Animation);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('videoSettings', { ...DEFAULT_VIDEO_EXPORT_SETTINGS });
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
