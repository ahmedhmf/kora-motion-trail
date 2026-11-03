import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Motion } from './motion';

describe('Motion', () => {
  let component: Motion;
  let fixture: ComponentFixture<Motion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Motion],
    }).compileComponents();

    fixture = TestBed.createComponent(Motion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
