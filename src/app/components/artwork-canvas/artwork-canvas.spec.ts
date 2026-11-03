import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ArtworkCanvas } from './artwork-canvas';

describe('ArtworkCanvas', () => {
  let component: ArtworkCanvas;
  let fixture: ComponentFixture<ArtworkCanvas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArtworkCanvas],
    }).compileComponents();

    fixture = TestBed.createComponent(ArtworkCanvas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
