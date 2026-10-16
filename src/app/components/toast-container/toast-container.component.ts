import { Component, inject } from '@angular/core';
import { ToastItem, ToastService, ToastTone } from '../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [],
  templateUrl: './toast-container.component.html',
  styleUrl: './toast-container.component.css'
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);
  readonly toasts = this.toastService.toasts;

  onDismiss(toast: ToastItem): void {
    this.toastService.dismiss(toast.id);
  }

  async onAction(toast: ToastItem): Promise<void> {
    if (toast.action) {
      await toast.action.run();
    }
  }

  getToneIconClass(tone: ToastTone): string {
    return `tone-${tone}`;
  }
}
