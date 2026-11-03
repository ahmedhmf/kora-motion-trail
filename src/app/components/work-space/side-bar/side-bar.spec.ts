import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SideBar } from './side-bar';
import { DEFAULT_VIDEO_EXPORT_SETTINGS } from '../../../models/video-export-settings.model';

describe('SideBar', () => {
  let component: SideBar;
  let fixture: ComponentFixture<SideBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SideBar],
    }).compileComponents();

    fixture = TestBed.createComponent(SideBar);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('videoSettings', { ...DEFAULT_VIDEO_EXPORT_SETTINGS });
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
