import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TemplateService } from '../../services/template.service';
import { ChecklistSessionService } from '../../services/checklist-session.service';
import { ChecklistTemplate, ImportConflictMode } from '../../models/checklist.model';
import { downloadBlob } from '../../services/download';
import { askImportConflict } from '../../services/import-conflict';

@Component({
  selector: 'app-templates-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './templates-list.component.html',
  styleUrl: './templates-list.component.css'
})
export class TemplatesListComponent implements OnInit {
  protected templateService = inject(TemplateService);
  private sessionService = inject(ChecklistSessionService);
  private router = inject(Router);

  expandedTemplates = signal<Record<string, boolean>>({});
  importError = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.templateService.initTemplates();
  }

  toggleExpand(templateId: string): void {
    const current = { ...this.expandedTemplates() };
    current[templateId] = !current[templateId];
    this.expandedTemplates.set(current);
  }

  isExpanded(templateId: string): boolean {
    return !!this.expandedTemplates()[templateId];
  }

  async launchChecklist(template: ChecklistTemplate): Promise<void> {
    const title = prompt(`Nom de la nouvelle checklist basée sur "${template.name}" :`, `${template.name} - ${new Date().toLocaleDateString('fr-FR')}`);
    if (title === null) return; // Annulé

    const newSess = await this.sessionService.createSession(template.id, title);
    this.router.navigate(['/checklists', newSess.id]);
  }

  exportTemplateJson(template: ChecklistTemplate): void {
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `template-${template.id}.json`);
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.importError.set(null);

    try {
      // Analyse complète d'abord : un fichier invalide est refusé sans dialogue.
      const template = this.templateService.parseTemplateFile(await file.text());
      input.value = '';

      let mode: ImportConflictMode = 'new';
      const existing = this.templateService.findTemplate(template.id);
      if (existing) {
        const choice = askImportConflict(`Un modèle « ${existing.name} »`, 'nouvel identifiant, nom suffixé « (import) »');
        if (!choice) return;
        mode = choice;
      }
      await this.templateService.importTemplate(template, mode);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'importation du template';
      this.importError.set(msg);
      input.value = '';
    }
  }

  async deleteTemplate(templateId: string): Promise<void> {
    if (confirm('Voulez-vous vraiment supprimer ce modèle de checklist ?')) {
      await this.templateService.deleteTemplate(templateId);
    }
  }
}
