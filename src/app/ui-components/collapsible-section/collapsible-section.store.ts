import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

type CollapsibleSectionState = {
  activeSection: ToolSection | null;
};

// Only one tool is expanded at a time. Open Mask on first load.
const initialState: CollapsibleSectionState = {
  activeSection: 'mask',
};

export const CollapsibleSectionStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    toggleSection(section: ToolSection): void {
      patchState(store, {
        activeSection: store.activeSection() === section ? null : section,
      });
    },
    isSectionOpen(section: ToolSection): boolean {
      return store.activeSection() === section;
    },
  })),
);
