import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

type CollapsibleSectionState = {
  openSections: Record<ToolSection, boolean>;
};

const initialState: CollapsibleSectionState = {
  openSections: {
    motion: false,
    colors: false,
    animation: false,
    export: false,
    mask: false,
  },
};

export const CollapsibleSectionStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    toggleSection: (section: ToolSection) => {
      patchState(store, (state) => ({
        openSections: {
          ...state.openSections,
          [section]: !state.openSections[section],
        },
      }));
    },
    isSectionOpen: (section: ToolSection) => store.openSections()[section],
  })),
);
