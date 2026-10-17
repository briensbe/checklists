import { Component, input, output } from '@angular/core';
import { LucideCheckCheck, LucideFileSpreadsheet, LucideFileText } from '@lucide/angular';
import { ChecklistTemplate, MetricsSummary } from '../../models/checklist.model';
import { FilterType } from '../../services/checklist-session.service';

@Component({
  selector: 'app-audit-summary',
  standalone: true,
  imports: [LucideCheckCheck, LucideFileSpreadsheet, LucideFileText],
  templateUrl: './audit-summary.component.html',
  styleUrl: './audit-summary.component.css'
})
export class AuditSummaryComponent {
  readonly template = input<ChecklistTemplate | null>(null);
  readonly contextValues = input<Record<string, string>>({});
  readonly metrics = input.required<MetricsSummary>();
  readonly filter = input<FilterType>('all');
  readonly readonly = input<boolean>(false);
  /** « Tout déplier » et « Tout replier » ne concernent que la vue liste (masqués en vue chemin). */
  readonly showCollapse = input<boolean>(true);

  readonly contextChange = output<{ key: string; value: string }>();
  readonly filterChange = output<FilterType>();
  readonly markAllOk = output<void>();
  readonly exportExcel = output<void>();
  readonly exportPdf = output<void>();
  readonly collapseAll = output<boolean>();

  onContextChange(key: string, event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target) {
      this.contextChange.emit({ key, value: target.value });
    }
  }
}
