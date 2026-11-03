import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ArtworkCanvas } from './artwork-canvas';
import { vi } from 'vitest';

describe('ArtworkCanvas', () => {
  let component: ArtworkCanvas;
  let fixture: ComponentFixture<ArtworkCanvas>;

  beforeEach(async () => {
    vi.stubGlobal('ResizeObserver', class {
      observe(): void {}
      disconnect(): void {}
    });
    await TestBed.configureTestingModule({
      imports: [ArtworkCanvas],
    }).compileComponents();

    fixture = TestBed.createComponent(ArtworkCanvas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
