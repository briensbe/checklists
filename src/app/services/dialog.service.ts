import { Injectable, signal } from '@angular/core';

export type DialogTone = 'primary' | 'secondary' | 'danger' | 'warning' | 'info';

export interface DialogChoiceOption<T = string> {
  id: T;
  label: string;
  tone?: DialogTone;
  isDefault?: boolean;
}

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: DialogTone;
}

export interface ChoiceDialogOptions<T = string> {
  title: string;
  message: string;
  choices: DialogChoiceOption<T>[];
  cancelLabel?: string;
}

export interface ActiveDialogState {
  type: 'confirm' | 'choice';
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: DialogTone;
  choices?: DialogChoiceOption<any>[];
  resolve: (value: any) => void;
}

@Injectable({
  providedIn: 'root'
})
export class DialogService {
  private readonly _activeDialog = signal<ActiveDialogState | null>(null);
  readonly activeDialog = this._activeDialog.asReadonly();

  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this._activeDialog.set({
        type: 'confirm',
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Confirmer',
        cancelLabel: options.cancelLabel ?? 'Annuler',
        confirmTone: options.confirmTone ?? 'primary',
        resolve: (val: boolean) => {
          this._activeDialog.set(null);
          resolve(val);
        }
      });
    });
  }

  choice<T = string>(options: ChoiceDialogOptions<T>): Promise<T | null> {
    return new Promise<T | null>((resolve) => {
      this._activeDialog.set({
        type: 'choice',
        title: options.title,
        message: options.message,
        choices: options.choices,
        cancelLabel: options.cancelLabel ?? 'Annuler',
        resolve: (val: T | null) => {
          this._activeDialog.set(null);
          resolve(val);
        }
      });
    });
  }

  close(): void {
    const dialog = this._activeDialog();
    if (dialog) {
      dialog.resolve(dialog.type === 'confirm' ? false : null);
      this._activeDialog.set(null);
    }
  }
}
