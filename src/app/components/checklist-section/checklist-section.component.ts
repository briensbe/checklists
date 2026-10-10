import { Component, input, output, computed } from '@angular/core';
import { ChecklistSectionTemplate, ChecklistItemTemplate, ItemAnswer, ControlStatus } from '../../models/checklist.model';
import { ChecklistItemComponent } from '../checklist-item/checklist-item.component';
import { FilterType } from '../../services/checklist-session.service';

@Component({
  selector: 'app-checklist-section',
  standalone: true,
  imports: [ChecklistItemComponent],
  templateUrl: './checklist-section.component.html',
  styleUrl: './checklist-section.component.css'
})
export class ChecklistSectionComponent {
  readonly section = input.required<ChecklistSectionTemplate>();
  readonly items = input.required<ChecklistItemTemplate[]>();
  readonly answers = input<Record<string, ItemAnswer>>({});
  readonly evidenceCounts = input<Record<string, number>>({});
  readonly isCollapsed = input<boolean>(false);
  readonly filter = input<FilterType>('all');

  readonly toggleCollapse = output<void>();
  readonly statusChange = output<{ itemId: string; status: ControlStatus }>();
  readonly checkboxChange = output<{ itemId: string; checked: boolean; withTimestamp: boolean }>();
  readonly choiceChange = output<{ itemId: string; choiceId: string }>();
  readonly commentChange = output<{ itemId: string; comment: string }>();
  readonly extraChange = output<{ itemId: string; key: string; value: string }>();
  readonly openEvidence = output<string>();

  readonly answeredCount = computed(() => {
    const itms = this.items();
    const ans = this.answers();
    return itms.filter(i => {
      const a = ans[i.id];
      if (!a) return false;
      const type = i.controlType || 'status';
      if (type === 'checkbox') return !!a.checked;
      if (type === 'choice') return !!a.selectedChoice;
      return !!a.status;
    }).length;
  });

  readonly filteredItems = computed(() => {
    const itms = this.items();
    const ans = this.answers();
    const f = this.filter();

    if (f === 'pending') {
      return itms.filter(i => {
        const a = ans[i.id];
        if (!a) return true;
        const type = i.controlType || 'status';
        if (type === 'checkbox') return !a.checked;
        if (type === 'choice') return !a.selectedChoice;
        return !a.status;
      });
    }
    if (f === 'ko') {
      return itms.filter(i => {
        const a = ans[i.id];
        if (!a) return false;
        const type = i.controlType || 'status';
        if (type === 'choice') {
          const opt = i.customChoices?.find(c => c.id === a.selectedChoice);
          return !!opt?.isBlocking;
        }
        return a.status === 'KO';
      });
    }
    return itms;
  });
}
