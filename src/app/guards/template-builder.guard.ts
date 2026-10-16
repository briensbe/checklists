import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { TemplateBuilderComponent } from '../pages/template-builder/template-builder.component';
import { DialogService } from '../services/dialog.service';

export const canDeactivateTemplateBuilder: CanDeactivateFn<TemplateBuilderComponent> = async (component) => {
  const dialogService = inject(DialogService);

  if (!component.isDirty()) {
    return true;
  }

  return await dialogService.confirm({
    title: 'Modifications non enregistrées',
    message: 'Vous avez des modifications non enregistrées. Voulez-vous vraiment quitter cette page ? Toutes les modifications non sauvegardées seront perdues.',
    confirmLabel: 'Quitter sans enregistrer',
    cancelLabel: 'Rester',
    confirmTone: 'danger'
  });
};
