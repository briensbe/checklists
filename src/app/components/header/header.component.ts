import { Component, inject, input, output } from '@angular/core';
import { ChecklistTemplate } from '../../models/checklist.model';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent {
  readonly themeService = inject(ThemeService);

  readonly template = input<ChecklistTemplate | null>(null);
  readonly templates = input<ChecklistTemplate[]>([]);
  readonly isSaving = input<boolean>(false);

  readonly templateChange = output<string>();
  readonly exportJson = output<void>();
  readonly importJson = output<string>();
  readonly resetSession = output<void>();

  onSelectTemplate(event: Event): void {
    const target = event.target as HTMLSelectElement;
    if (target?.value) {
      this.templateChange.emit(target.value);
    }
  }

  onFileImport(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content) {
          this.importJson.emit(content);
        }
      };
      reader.readAsText(file);
      input.value = '';
    }
  }
}
