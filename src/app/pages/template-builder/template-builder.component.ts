import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TemplateService } from '../../services/template.service';
import { ToastService } from '../../services/toast.service';
import { ChecklistTemplate, ChecklistSectionTemplate, ChecklistItemTemplate, ChoiceTone, ItemControlType } from '../../models/checklist.model';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-template-builder',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './template-builder.component.html',
  styleUrl: './template-builder.component.css'
})
export class TemplateBuilderComponent implements OnInit, OnDestroy {
  private templateService = inject(TemplateService);
  private toastService = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  isEditing = signal<boolean>(false);
  template = signal<ChecklistTemplate>({
    id: '',
    name: 'Nouveau modèle de checklist',
    description: '',
    version: '1.0.0',
    updatedAt: '',
    contextSchema: [],
    sections: []
  });

  previewMode = signal<boolean>(false);

  readonly tones: { value: ChoiceTone; label: string }[] = [
    { value: 'success', label: 'Vert (succès)' },
    { value: 'danger', label: 'Rouge (anomalie)' },
    { value: 'warning', label: 'Orange (alerte)' },
    { value: 'info', label: 'Bleu (information)' },
    { value: 'neutral', label: 'Gris (neutre)' }
  ];

  async ngOnInit(): Promise<void> {
    await this.templateService.initTemplates();
    const id = this.route.snapshot.paramMap.get('id');

    if (id) {
      const existing = this.templateService.availableTemplates().find(t => t.id === id);
      if (existing) {
        this.isEditing.set(true);
        // Deep clone pour ne pas modifier avant sauvegarde
        this.template.set(JSON.parse(JSON.stringify(existing)));
        return;
      }
    }

    // Création d'un nouveau template avec une première section par défaut
    this.template.set({
      id: `template-${Date.now()}`,
      name: 'Nouveau modèle',
      description: 'Description du modèle',
      version: '1.0.0',
      updatedAt: '',
      contextSchema: [],
      sections: [
        {
          id: `sec-${Date.now()}`,
          title: 'Section 1',
          icon: '',
          items: [
            {
              id: `item-${Date.now()}`,
              label: 'Premier contrôle ou tâche',
              controlType: 'checkbox',
              withTimestamp: false
            }
          ]
        }
      ]
    });
  }

  ngOnDestroy(): void {
    this.toastService.flushPending();
  }

  // Gestion des sections
  addSection(): void {
    const t = { ...this.template() };
    t.sections.push({
      id: `sec-${Date.now()}`,
      title: `Nouvelle Section ${t.sections.length + 1}`,
      icon: '',
      items: []
    });
    this.template.set(t);
  }

  removeSection(index: number): void {
    const t = { ...this.template() };
    const [removed] = t.sections.splice(index, 1);
    this.template.set(t);

    this.toastService.showDeferred({
      message: `Section « ${removed.title} » supprimée`,
      durationMs: 6000,
      undoLabel: 'Annuler',
      onCommit: () => {},
      onUndo: () => {
        const cur = { ...this.template() };
        cur.sections.splice(index, 0, removed);
        this.template.set(cur);
      }
    });
  }

  moveSection(index: number, direction: 'up' | 'down'): void {
    const t = { ...this.template() };
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= t.sections.length) return;
    const [sec] = t.sections.splice(index, 1);
    t.sections.splice(targetIndex, 0, sec);
    this.template.set(t);
  }

  // Gestion des items
  addItem(section: ChecklistSectionTemplate): void {
    section.items.push({
      id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      label: 'Nouvelle tâche',
      controlType: 'checkbox',
      withTimestamp: false
    });
  }

  removeItem(section: ChecklistSectionTemplate, itemIndex: number): void {
    const [removed] = section.items.splice(itemIndex, 1);
    this.toastService.showDeferred({
      message: `Contrôle « ${removed.label} » supprimé`,
      durationMs: 6000,
      undoLabel: 'Annuler',
      onCommit: () => {},
      onUndo: () => {
        section.items.splice(itemIndex, 0, removed);
        this.template.set({ ...this.template() });
      }
    });
  }

  onControlTypeChange(item: ChecklistItemTemplate, type: ItemControlType): void {
    item.controlType = type;
    if (type === 'choice' && (!item.customChoices || item.customChoices.length === 0)) {
      item.customChoices = [
        { id: 'opt-1', label: 'Option 1', tone: 'success' },
        { id: 'opt-2', label: 'Option 2', tone: 'danger', isBlocking: true }
      ];
    }
  }

  addChoiceOption(item: ChecklistItemTemplate): void {
    if (!item.customChoices) item.customChoices = [];
    item.customChoices.push({
      id: `opt-${Date.now()}`,
      label: `Option ${item.customChoices.length + 1}`,
      tone: 'neutral',
      isBlocking: false
    });
  }

  removeChoiceOption(item: ChecklistItemTemplate, index: number): void {
    item.customChoices?.splice(index, 1);
  }

  // Sauvegarde
  async save(): Promise<void> {
    const t = this.template();
    if (!t.name.trim()) {
      this.toastService.warning('Veuillez renseigner un nom pour le modèle.');
      return;
    }
    if (t.sections.length === 0) {
      this.toastService.warning('Veuillez ajouter au moins une section.');
      return;
    }

    await this.templateService.saveTemplate(t);
    this.toastService.success('Modèle enregistré avec succès.');
    this.router.navigate(['/templates']);
  }
}
