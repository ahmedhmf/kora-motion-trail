import { Component, inject, input } from '@angular/core';
import { CollapsibleSectionStore } from './collapsible-section.store';
import type { ToolSection } from '../../models/tool-section.type';

@Component({
  imports: [],
  selector: 'app-collapsible-section',
  styleUrl: './collapsible-section.css',
  templateUrl: './collapsible-section.html',
})
export class CollapsibleSection {
  readonly collapsibleSectionStore = inject(CollapsibleSectionStore);

  readonly section = input.required<ToolSection>();
  readonly title = input.required<string>();
  readonly icon = input.required<string>();
}
