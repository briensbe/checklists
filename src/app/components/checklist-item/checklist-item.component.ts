import { Component, input, output, signal } from '@angular/core';
import { ChecklistItemTemplate, ItemAnswer, ControlStatus } from '../../models/checklist.model';

@Component({
  selector: 'app-checklist-item',
  standalone: true,
  templateUrl: './checklist-item.component.html',
  styleUrl: './checklist-item.component.css'
})
export class ChecklistItemComponent {
  readonly item = input.required<ChecklistItemTemplate>();
  readonly answer = input<ItemAnswer | undefined>();
  readonly evidenceCount = input<number>(0);

  readonly statusChange = output<ControlStatus>();
  readonly commentChange = output<string>();
  readonly extraChange = output<{ key: string; value: string }>();
  readonly openEvidence = output<string>();

  private manuallyOpenedComment = signal<boolean>(false);

  isCommentBoxVisible(): boolean {
    const ans = this.answer();
    if (this.manuallyOpenedComment()) return true;
    if (ans && (ans.status === 'KO' || ans.status === 'NA' || !!ans.comment)) {
      return true;
    }
    return false;
  }

  toggleCommentBox(): void {
    this.manuallyOpenedComment.update(v => !v);
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
