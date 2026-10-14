import { Component, input, output, signal, computed } from '@angular/core';
import { ChecklistItemTemplate, ItemAnswer, ControlStatus } from '../../models/checklist.model';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-checklist-item',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './checklist-item.component.html',
  styleUrl: './checklist-item.component.css'
})
export class ChecklistItemComponent {
  readonly item = input.required<ChecklistItemTemplate>();
  readonly answer = input<ItemAnswer | undefined>();
  readonly evidenceCount = input<number>(0);
  readonly readonly = input<boolean>(false);

  readonly requireNaReason = computed<boolean>(() => !!this.item().requireNaReason);

  readonly statusChange = output<ControlStatus>();
  readonly checkboxChange = output<{ checked: boolean; withTimestamp: boolean }>();
  readonly choiceChange = output<string>();
  readonly commentChange = output<string>();
  readonly extraChange = output<{ key: string; value: string }>();
  readonly openEvidence = output<string>();

  private manuallyOpenedComment = signal<boolean>(false);

  isCommentBoxVisible(): boolean {
    const ans = this.answer();
    if (this.manuallyOpenedComment()) return true;
    if (ans) {
      if (ans.status === 'KO') return true;
      if (ans.status === 'NA' && this.requireNaReason()) return true;
      if (!!ans.comment) return true;
    }
    return false;
  }

  toggleCommentBox(): void {
    this.manuallyOpenedComment.update(v => !v);
  }

  onCheckboxToggle(event: Event): void {
    const target = event.target as HTMLInputElement;
    const isChecked = target.checked;
    this.checkboxChange.emit({
      checked: isChecked,
      withTimestamp: !!this.item().withTimestamp
    });
  }

  onCommentChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target) {
      this.commentChange.emit(target.value);
    }
  }

  onExtraChange(key: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target) {
      this.extraChange.emit({ key, value: target.value });
    }
  }
}
