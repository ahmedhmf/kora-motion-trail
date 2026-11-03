import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollapsibleSection } from './collapsible-section';
import { CollapsibleSectionStore } from './collapsible-section.store';

describe('CollapsibleSection', () => {
  let component: CollapsibleSection;
  let fixture: ComponentFixture<CollapsibleSection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CollapsibleSection],
    }).compileComponents();

    fixture = TestBed.createComponent(CollapsibleSection);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens only one tool section at a time', () => {
    const store = TestBed.inject(CollapsibleSectionStore);

    expect(store.isSectionOpen('mask')).toBe(true);

    store.toggleSection('presets');
    expect(store.isSectionOpen('presets')).toBe(true);
    expect(store.isSectionOpen('mask')).toBe(false);

    store.toggleSection('colors');
    expect(store.isSectionOpen('colors')).toBe(true);
    expect(store.isSectionOpen('presets')).toBe(false);

    store.toggleSection('colors');
    expect(store.isSectionOpen('colors')).toBe(false);
  });
});
