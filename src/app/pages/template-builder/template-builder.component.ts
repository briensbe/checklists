import { Component, computed, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TemplateService } from '../../services/template.service';
import { ToastService } from '../../services/toast.service';
import { DialogService } from '../../services/dialog.service';
import {
  ChecklistTemplate,
  ChecklistSectionTemplate,
  ChecklistItemTemplate,
  ChoiceTone,
  Criticality,
  EVIDENCE_KINDS,
  EvidenceKind,
  ItemControlType,
  ContextFieldSchema,
  ContextFieldType
} from '../../models/checklist.model';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import {
  LucideArrowDown,
  LucideArrowLeft,
  LucideArrowUp,
  LucideCamera,
  LucideChevronRight,
  LucideClock,
  LucideCopy,
  LucideEye,
  LucideFile,
  LucideGripVertical,
  LucideLink,
  LucideMessageSquare,
  LucidePencil,
  LucideSave,
  LucideTrash,
  LucideX
} from '@lucide/angular';
import { criticalityOf } from '../../domain/session-rules';
import {
  duplicateItem,
  duplicateSection,
  findVisibleIfOrphans,
  nextCriticality,
  removeSectionFromDependencies,
  setItemCriticality,
  setItemEvidence,
  validateTemplateIntegrity
} from './template-builder.helpers';

const CRITICALITY_LABELS: Record<Criticality, string> = {
  blocking: 'bloquant',
  important: 'important',
  optional: 'optionnel'
};

const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  comment: 'Commentaire',
  photo: 'Photo',
  link: 'Lien',
  file: 'Fichier'
};

@Component({
  selector: 'app-template-builder',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    DragDropModule,
    LucideArrowDown,
    LucideArrowLeft,
    LucideArrowUp,
    LucideCamera,
    LucideChevronRight,
    LucideClock,
    LucideCopy,
    LucideEye,
    LucideFile,
    LucideGripVertical,
    LucideLink,
    LucideMessageSquare,
    LucidePencil,
    LucideSave,
    LucideTrash,
    LucideX
  ],
  templateUrl: './template-builder.component.html',
  styleUrl: './template-builder.component.css'
})
export class TemplateBuilderComponent implements OnInit, OnDestroy {
  private templateService = inject(TemplateService);
  private toastService = inject(ToastService);
  private dialogService = inject(DialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  isEditing = signal<boolean>(false);
  existingItemIds = signal<Set<string>>(new Set());
  initialSnapshot = signal<string>('');

  template = signal<ChecklistTemplate>({
    id: '',
    name: 'Nouveau modèle de checklist',
    description: '',
    version: '1.0.0',
    updatedAt: '',
    contextSchema: [],
    sections: []
  });

  isDirty = computed(() => {
    const snap = this.initialSnapshot();
    if (!snap) return false;
    return JSON.stringify(this.template()) !== snap;
  });

  connectedDropLists = computed(() => {
    return this.template().sections.map(s => 'items-list-' + s.id);
  });

  advancedOpen = signal<Record<string, boolean>>({});

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isDirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  previewMode = signal<boolean>(false);

  readonly tones: { value: ChoiceTone; label: string }[] = [
    { value: 'success', label: 'Vert (succès)' },
    { value: 'danger', label: 'Rouge (anomalie)' },
    { value: 'warning', label: 'Orange (alerte)' },
    { value: 'info', label: 'Bleu (information)' },
    { value: 'neutral', label: 'Gris (neutre)' }
  ];

  readonly contextTypes: { value: ContextFieldType; label: string }[] = [
    { value: 'text', label: 'Texte libre' },
    { value: 'date', label: 'Date' },
    { value: 'select', label: 'Liste de choix' }
  ];

  readonly evidenceKinds = EVIDENCE_KINDS.map(value => ({ value, label: EVIDENCE_LABELS[value] }));
  protected readonly criticalityOf = criticalityOf;
  protected readonly criticalityLabels = CRITICALITY_LABELS;
  protected readonly evidenceLabels = EVIDENCE_LABELS;

  async ngOnInit(): Promise<void> {
    await this.templateService.initTemplates();
    const id = this.route.snapshot.paramMap.get('id');

    if (id) {
      const existing = this.templateService.availableTemplates().find(t => t.id === id);
      if (existing) {
        this.isEditing.set(true);
        const cloned: ChecklistTemplate = JSON.parse(JSON.stringify(existing));
        if (!cloned.contextSchema) {
          cloned.contextSchema = [];
        }
        const itemIds = new Set<string>();
        (cloned.sections || []).forEach(sec => {
          (sec.items || []).forEach(it => {
            if (it.id) itemIds.add(it.id);
          });
        });
        this.existingItemIds.set(itemIds);
        this.template.set(cloned);
        this.initialSnapshot.set(JSON.stringify(cloned));
        return;
      }
    }

    // Création d'un nouveau template avec une première section par défaut
    const defaultTemplate: ChecklistTemplate = {
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
              criticality: 'optional',
              withTimestamp: false
            }
          ]
        }
      ]
    };

    this.template.set(defaultTemplate);
    this.initialSnapshot.set(JSON.stringify(defaultTemplate));
  }

  ngOnDestroy(): void {
    this.toastService.flushPending();
  }

  isExistingItem(itemId: string): boolean {
    return this.isEditing() && this.existingItemIds().has(itemId);
  }

  // --- Gestion du schéma de contexte ---
  addContextField(): void {
    const t = this.template();
    const count = (t.contextSchema || []).length + 1;
    const newField: ContextFieldSchema = {
      id: `field_${Date.now().toString(36)}`,
      label: `Champ ${count}`,
      type: 'text',
      required: false,
      defaultValue: '',
      placeholder: ''
    };
    const contextSchema = [...(t.contextSchema || []), newField];
    this.template.update(cur => ({ ...cur, contextSchema }));
  }

  async removeContextField(index: number): Promise<void> {
    const t = this.template();
    const field = (t.contextSchema || [])[index];
    if (!field) return;

    // Détection des dépendances orphelines éventuelles
    const dependentItems: string[] = [];
    for (const sec of t.sections || []) {
      for (const item of sec.items || []) {
        if (item.visibleIf?.fieldId === field.id) {
          dependentItems.push(item.label || item.id);
        }
      }
    }

    if (dependentItems.length > 0) {
      const confirmed = await this.dialogService.confirm({
        title: 'Champ de contexte utilisé',
        message: `Le champ « ${field.label || field.id} » est utilisé par ${dependentItems.length} contrôle(s) (${dependentItems.slice(0, 3).join(', ')}${dependentItems.length > 3 ? '...' : ''}). La suppression rendra ces conditions invalides. Voulez-vous continuer ?`,
        confirmLabel: 'Supprimer quand même',
        cancelLabel: 'Annuler',
        confirmTone: 'warning'
      });
      if (!confirmed) return;
    }

    const contextSchema = [...t.contextSchema];
    contextSchema.splice(index, 1);
    this.template.update(cur => ({ ...cur, contextSchema }));
  }

  onContextFieldTypeChange(field: ContextFieldSchema, type: ContextFieldType): void {
    field.type = type;
    if (type === 'select' && (!field.options || field.options.length === 0)) {
      field.options = [
        { label: 'Option 1', value: 'opt_1' },
        { label: 'Option 2', value: 'opt_2' }
      ];
      field.defaultValue = 'opt_1';
    }
  }

  addContextFieldOption(field: ContextFieldSchema): void {
    if (!field.options) field.options = [];
    const idx = field.options.length + 1;
    const label = `Option ${idx}`;
    field.options.push({
      label,
      value: `opt_${Date.now().toString(36)}_${idx}`
    });
  }

  onContextOptionLabelChange(opt: { label: string; value: string }, newLabel: string): void {
    const oldVal = opt.value;
    opt.label = newLabel;
    // Si la valeur technique était auto-générée ou synchronisée, la synchroniser harmonieusement
    if (!oldVal || oldVal.startsWith('opt_') || oldVal === '') {
      opt.value = newLabel.trim().toLowerCase().replace(/[\s\W-]+/g, '_') || `opt_${Date.now().toString(36)}`;
    }
  }

  removeContextFieldOption(field: ContextFieldSchema, optIdx: number): void {
    field.options?.splice(optIdx, 1);
  }

  // --- Gestion des sections ---
  addSection(): void {
    const t = this.template();
    const newSection: ChecklistSectionTemplate = {
      id: `sec-${crypto.randomUUID()}`,
      title: `Nouvelle Section ${(t.sections || []).length + 1}`,
      icon: '',
      items: []
    };
    const sections = [...(t.sections || []), newSection];
    this.template.update(cur => ({ ...cur, sections }));
  }

  duplicateSection(index: number): void {
    const t = this.template();
    const sec = (t.sections || [])[index];
    if (!sec) return;
    const copy = duplicateSection(sec);
    const sections = [...t.sections];
    sections.splice(index + 1, 0, copy);
    this.template.update(cur => ({ ...cur, sections }));
    this.toastService.info(`Section « ${copy.title} » dupliquée.`);
  }

  removeSection(index: number): void {
    const t = this.template();
    const remaining = [...t.sections];
    const [removed] = remaining.splice(index, 1);
    // Les sections qui dépendaient de la section supprimée perdent cette dépendance.
    const dependentIds = remaining.filter(s => s.dependsOn?.includes(removed.id)).map(s => s.id);
    const sections = removeSectionFromDependencies(remaining, removed.id);
    this.template.update(cur => ({ ...cur, sections }));

    this.toastService.showDeferred({
      message: `Section « ${removed.title} » supprimée`,
      durationMs: 6000,
      undoLabel: 'Annuler',
      onCommit: () => {},
      onUndo: () => {
        // On restaure la section et ses dépendances sur l'état courant (d'autres modifications ont pu suivre).
        const curSections = this.template().sections.map(s =>
          dependentIds.includes(s.id) && !s.dependsOn?.includes(removed.id)
            ? { ...s, dependsOn: [...(s.dependsOn ?? []), removed.id] }
            : s
        );
        curSections.splice(index, 0, removed);
        this.template.update(cur => ({ ...cur, sections: curSections }));
      }
    });
  }

  moveSection(index: number, direction: 'up' | 'down'): void {
    const t = this.template();
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= t.sections.length) return;
    const sections = [...t.sections];
    const [sec] = sections.splice(index, 1);
    sections.splice(targetIndex, 0, sec);
    this.template.update(cur => ({ ...cur, sections }));
  }

  onSectionDrop(event: CdkDragDrop<ChecklistSectionTemplate[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const sections = [...this.template().sections];
    moveItemInArray(sections, event.previousIndex, event.currentIndex);
    this.template.update(cur => ({ ...cur, sections }));
  }

  // --- Gestion des items ---
  addItem(section: ChecklistSectionTemplate): void {
    // Valeurs par défaut écrites explicitement : case à cocher, criticité « optionnel » (ADR 0007).
    const newItem: ChecklistItemTemplate = {
      id: `item-${crypto.randomUUID()}`,
      label: 'Nouvelle tâche',
      controlType: 'checkbox',
      criticality: 'optional',
      withTimestamp: false
    };
    section.items.push(newItem);
    this.template.update(cur => ({ ...cur }));
  }

  // --- Criticité et preuve exigée (mises à jour immuables, ADR 0006) ---
  cycleCriticality(item: ChecklistItemTemplate): void {
    const next = nextCriticality(criticalityOf(item));
    this.template.update(t => setItemCriticality(t, item.id, next));
  }

  criticalityAriaLabel(item: ChecklistItemTemplate): string {
    const label = CRITICALITY_LABELS[criticalityOf(item)];
    return `Criticité : ${label}. Cliquer pour passer à « ${CRITICALITY_LABELS[nextCriticality(criticalityOf(item))]} »`;
  }

  onEvidenceKindChange(item: ChecklistItemTemplate, value: string): void {
    const kind = EVIDENCE_KINDS.find(k => k === value) ?? null;
    this.template.update(t => setItemEvidence(t, item.id, kind, item.evidenceHint));
  }

  onEvidenceHintChange(item: ChecklistItemTemplate, hint: string): void {
    if (!item.evidenceRequired) return;
    this.template.update(t => setItemEvidence(t, item.id, item.evidenceRequired ?? null, hint));
  }

  duplicateItem(section: ChecklistSectionTemplate, itemIndex: number): void {
    const item = section.items[itemIndex];
    if (!item) return;
    const copy = duplicateItem(item);
    section.items.splice(itemIndex + 1, 0, copy);
    this.template.update(cur => ({ ...cur }));
    this.toastService.info(`Contrôle « ${copy.label} » dupliqué.`);
  }

  removeItem(section: ChecklistSectionTemplate, itemIndex: number): void {
    const [removed] = section.items.splice(itemIndex, 1);
    this.template.update(cur => ({ ...cur }));

    this.toastService.showDeferred({
      message: `Contrôle « ${removed.label} » supprimé`,
      durationMs: 6000,
      undoLabel: 'Annuler',
      onCommit: () => {},
      onUndo: () => {
        section.items.splice(itemIndex, 0, removed);
        this.template.update(cur => ({ ...cur }));
      }
    });
  }

  moveItem(section: ChecklistSectionTemplate, index: number, direction: 'up' | 'down'): void {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= section.items.length) return;
    const items = [...section.items];
    const [item] = items.splice(index, 1);
    items.splice(targetIndex, 0, item);
    section.items = items;
    this.template.update(cur => ({ ...cur }));
  }

  onItemDrop(event: CdkDragDrop<ChecklistItemTemplate[]>, targetSection: ChecklistSectionTemplate): void {
    if (event.previousContainer === event.container) {
      if (event.previousIndex === event.currentIndex) return;
      const items = [...targetSection.items];
      moveItemInArray(items, event.previousIndex, event.currentIndex);
      targetSection.items = items;
      this.template.update(cur => ({ ...cur }));
    } else {
      const sourceItems = event.previousContainer.data;
      const targetItems = event.container.data;
      transferArrayItem(sourceItems, targetItems, event.previousIndex, event.currentIndex);
      this.template.update(cur => ({ ...cur }));
    }
  }

  onControlTypeChange(item: ChecklistItemTemplate, type: ItemControlType): void {
    item.controlType = type;
    if (type === 'choice' && (!item.customChoices || item.customChoices.length === 0)) {
      item.customChoices = [
        { id: `opt-${crypto.randomUUID()}`, label: 'Option 1', tone: 'success' },
        { id: `opt-${crypto.randomUUID()}`, label: 'Option 2', tone: 'danger', isBlocking: true }
      ];
    }
  }

  addChoiceOption(item: ChecklistItemTemplate): void {
    if (!item.customChoices) item.customChoices = [];
    item.customChoices.push({
      id: `opt-${crypto.randomUUID()}`,
      label: `Option ${item.customChoices.length + 1}`,
      tone: 'neutral',
      isBlocking: false
    });
  }

  removeChoiceOption(item: ChecklistItemTemplate, index: number): void {
    item.customChoices?.splice(index, 1);
  }

  // --- Options avancées par item ---
  toggleAdvanced(itemId: string): void {
    this.advancedOpen.update(map => ({
      ...map,
      [itemId]: !map[itemId]
    }));
  }

  isAdvancedOpen(itemId: string): boolean {
    return !!this.advancedOpen()[itemId];
  }

  toggleExtraField(item: ChecklistItemTemplate, enabled: boolean): void {
    if (enabled) {
      item.extraField = {
        id: `extra_${Date.now().toString(36)}`,
        label: 'Observation ou détail additionnel',
        placeholder: 'Saisissez ici...'
      };
    } else {
      delete item.extraField;
    }
  }

  toggleVisibleIf(item: ChecklistItemTemplate, enabled: boolean): void {
    if (enabled) {
      const firstField = (this.template().contextSchema || [])[0];
      const defaultFieldId = firstField ? firstField.id : '';
      const defaultEquals =
        firstField && firstField.type === 'select' && firstField.options?.[0]
          ? [firstField.options[0].value]
          : [];
      item.visibleIf = {
        fieldId: defaultFieldId,
        equals: defaultEquals
      };
    } else {
      delete item.visibleIf;
    }
  }

  onVisibleIfFieldChange(item: ChecklistItemTemplate, fieldId: string): void {
    if (!item.visibleIf) return;
    item.visibleIf.fieldId = fieldId;
    const field = (this.template().contextSchema || []).find(f => f.id === fieldId);
    if (field && field.type === 'select' && field.options && field.options.length > 0) {
      item.visibleIf.equals = [field.options[0].value];
    } else {
      item.visibleIf.equals = [];
    }
  }

  isOptionSelectedInVisibleIf(item: ChecklistItemTemplate, val: string): boolean {
    return !!item.visibleIf?.equals?.includes(val);
  }

  toggleVisibleIfOption(item: ChecklistItemTemplate, val: string): void {
    if (!item.visibleIf) return;
    const current = new Set(item.visibleIf.equals || []);
    if (current.has(val)) {
      current.delete(val);
    } else {
      current.add(val);
    }
    item.visibleIf.equals = Array.from(current);
  }

  onVisibleIfTextChange(item: ChecklistItemTemplate, rawText: string): void {
    if (!item.visibleIf) return;
    item.visibleIf.equals = rawText.split(',').map(s => s.trim()).filter(Boolean);
  }

  getFieldOptions(fieldId: string): { label: string; value: string }[] {
    const field = (this.template().contextSchema || []).find(f => f.id === fieldId);
    return field?.options || [];
  }

  getFieldType(fieldId: string): ContextFieldType | undefined {
    return (this.template().contextSchema || []).find(f => f.id === fieldId)?.type;
  }

  getContextFieldLabel(fieldId: string): string {
    const field = (this.template().contextSchema || []).find(f => f.id === fieldId);
    return field?.label || fieldId;
  }

  formatVisibleIfValues(item: ChecklistItemTemplate): string {
    if (!item.visibleIf) return '';
    const field = (this.template().contextSchema || []).find(f => f.id === item.visibleIf!.fieldId);
    if (field && field.type === 'select' && field.options) {
      const labels = item.visibleIf.equals.map(val => {
        const opt = field.options?.find(o => o.value === val);
        return opt?.label || val;
      });
      return labels.join(', ');
    }
    return item.visibleIf.equals.join(', ');
  }

  // --- Sauvegarde & Validation ---
  async save(): Promise<void> {
    const t = this.template();
    const integrity = validateTemplateIntegrity(t);
    if (!integrity.valid) {
      this.toastService.warning(integrity.errors[0]);
      return;
    }

    const orphans = findVisibleIfOrphans(t, t.contextSchema || []);
    if (orphans.length > 0) {
      this.toastService.warning(
        `Le contrôle « ${orphans[0].itemLabel} » cible un champ de contexte inexistant (« ${orphans[0].fieldId} »).`
      );
      return;
    }

    t.updatedAt = new Date().toISOString();
    await this.templateService.saveTemplate(t);
    this.initialSnapshot.set(JSON.stringify(t));
    this.toastService.success('Modèle enregistré avec succès.');
    this.router.navigate(['/templates']);
  }
}
