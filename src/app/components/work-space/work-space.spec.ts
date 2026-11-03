import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WorkSpace } from './work-space';

describe('WorkSpace', () => {
  let component: WorkSpace;
  let fixture: ComponentFixture<WorkSpace>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkSpace],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkSpace);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
