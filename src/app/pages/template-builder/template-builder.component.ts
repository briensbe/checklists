import { Component, computed, DOCUMENT, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TemplateService } from '../../services/template.service';
import { ToastService } from '../../services/toast.service';
import { DialogService } from '../../services/dialog.service';
import {
  ChecklistTemplate,
  ChecklistSectionTemplate,
  ChecklistItemTemplate,
  ChoiceTone,
  CompletionPolicy,
  Criticality,
  EVIDENCE_KINDS,
  EvidenceKind,
  ItemControlType,
  ContextFieldSchema,
  ContextFieldType,
  CustomChoiceOption,
  ExtraFieldSchema,
  GateKind,
  JoinMode,
  VisibilityCondition
} from '../../models/checklist.model';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
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
import { StepIconName } from '../../domain/step-icons';
import { FlowPreviewComponent } from '../../components/flow-preview/flow-preview.component';
import { SectionFlowSettingsComponent } from '../../components/section-flow-settings/section-flow-settings.component';
import { StepIconPickerComponent } from '../../components/step-icon-picker/step-icon-picker.component';
import {
  dependencyChips,
  newSectionDependencies,
  sectionsWithDependents,
  setCompletionPolicy,
  setSectionGate,
  setSectionIcon,
  setSectionJoinMode,
  toggleDependency
} from './flow-editor.helpers';
import {
  addItem,
  duplicateItem,
  duplicateSection,
  findVisibleIfOrphans,
  insertItemAt,
  moveItemBetween,
  moveItemWithin,
  nextCriticality,
  removeItemAt,
  removeSectionFromDependencies,
  reorderArray,
  setItemCriticality,
  setItemEvidence,
  updateContextField,
  updateItem,
  updateSection,
  updateTemplate,
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
    FlowPreviewComponent,
    SectionFlowSettingsComponent,
    StepIconPickerComponent,
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
  private document = inject(DOCUMENT);

  isEditing = signal<boolean>(false);
  existingItemIds = signal<Set<string>>(new Set());
  initialSnapshot = signal<string>('');

  /**
   * Modèle en cours d'édition. Il n'est JAMAIS modifié en place : chaque modification passe par
   * `template.update()` et un helper immuable, sinon les `computed` qui le lisent (`isDirty`,
   * aperçu du graphe) ne verraient pas le changement (design D1 de builder-flow-editor).
   */
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

  /** Puces « Après : » de chaque section, recalculées à chaque modification du modèle. */
  protected readonly chipsBySection = computed(() => {
    const t = this.template();
    return Object.fromEntries(t.sections.map(s => [s.id, dependencyChips(t, s.id)]));
  });
  /** Sections dont au moins une autre dépend : seules celles-là proposent le choix de la porte. */
  protected readonly sectionsWithDependents = computed(() => sectionsWithDependents(this.template()));

  readonly completionPolicies: { value: CompletionPolicy; label: string; hint: string }[] = [
    { value: 'blocking', label: 'Seuls les bloquants', hint: 'Seuls les contrôles bloquants empêchent de terminer.' },
    { value: 'all', label: 'Une réponse partout', hint: 'Chaque contrôle applicable doit avoir une réponse pour terminer.' }
  ];

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
      // Nouveau modèle : seuls les bloquants empêchent de terminer (valeur écrite explicitement, ADR 0007).
      completionPolicy: 'blocking',
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

  // --- Champs du formulaire : chaque saisie produit un nouveau modèle (design D1) ---
  patchTemplate(patch: Partial<ChecklistTemplate>): void {
    this.template.update(t => updateTemplate(t, patch));
  }

  patchSection(sectionId: string, patch: Partial<ChecklistSectionTemplate>): void {
    this.template.update(t => updateSection(t, sectionId, s => ({ ...s, ...patch })));
  }

  patchItem(itemId: string, patch: Partial<ChecklistItemTemplate>): void {
    this.template.update(t => updateItem(t, itemId, i => ({ ...i, ...patch })));
  }

  patchChoice(itemId: string, choiceId: string, patch: Partial<CustomChoiceOption>): void {
    this.template.update(t =>
      updateItem(t, itemId, i => ({
        ...i,
        customChoices: (i.customChoices ?? []).map(c => (c.id === choiceId ? { ...c, ...patch } : c))
      }))
    );
  }

  patchExtraField(itemId: string, patch: Partial<ExtraFieldSchema>): void {
    this.template.update(t => updateItem(t, itemId, i => (i.extraField ? { ...i, extraField: { ...i.extraField, ...patch } } : i)));
  }

  patchContextField(index: number, patch: Partial<ContextFieldSchema>): void {
    this.template.update(t => updateContextField(t, index, f => ({ ...f, ...patch })));
  }

  // --- Enchaînement des étapes (change builder-flow-editor) ---
  onCompletionPolicyChange(policy: CompletionPolicy): void {
    this.template.update(t => setCompletionPolicy(t, policy));
  }

  onToggleDependency(sectionId: string, dependencyId: string): void {
    this.template.update(t => toggleDependency(t, sectionId, dependencyId));
  }

  onGateChange(sectionId: string, gate: GateKind): void {
    this.template.update(t => setSectionGate(t, sectionId, gate));
  }

  onJoinModeChange(sectionId: string, joinMode: JoinMode): void {
    this.template.update(t => setSectionJoinMode(t, sectionId, joinMode));
  }

  onIconPick(sectionId: string, icon: StepIconName): void {
    this.template.update(t => setSectionIcon(t, sectionId, icon));
  }

  dependencyCount(section: ChecklistSectionTemplate): number {
    return Array.isArray(section.dependsOn) ? section.dependsOn.length : 0;
  }

  /** Nœud choisi dans l'aperçu : on amène la carte de la section à l'écran et on donne le focus à son titre. */
  focusSection(sectionId: string): void {
    const card = this.document.getElementById(`section-${sectionId}`);
    if (!card) return;
    const reduceMotion = this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    // Centrée, la carte ne passe pas sous l'en-tête fixe de l'application.
    card.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    card.querySelector<HTMLInputElement>('.section-title-input')?.focus({ preventScroll: true });
  }

  // --- Gestion du schéma de contexte ---
  addContextField(): void {
    const count = (this.template().contextSchema || []).length + 1;
    const newField: ContextFieldSchema = {
      id: `field_${Date.now().toString(36)}`,
      label: `Champ ${count}`,
      type: 'text',
      required: false,
      defaultValue: '',
      placeholder: ''
    };
    this.template.update(cur => ({ ...cur, contextSchema: [...(cur.contextSchema || []), newField] }));
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

    // Retrait par identité : le schéma a pu changer pendant la confirmation.
    this.template.update(cur => ({ ...cur, contextSchema: cur.contextSchema.filter(f => f !== field) }));
  }

  onContextFieldTypeChange(index: number, type: ContextFieldType): void {
    this.template.update(t =>
      updateContextField(t, index, field =>
        type === 'select' && (!field.options || field.options.length === 0)
          ? {
              ...field,
              type,
              options: [
                { label: 'Option 1', value: 'opt_1' },
                { label: 'Option 2', value: 'opt_2' }
              ],
              defaultValue: 'opt_1'
            }
          : { ...field, type }
      )
    );
  }

  addContextFieldOption(index: number): void {
    this.template.update(t =>
      updateContextField(t, index, field => {
        const idx = (field.options?.length ?? 0) + 1;
        return { ...field, options: [...(field.options ?? []), { label: `Option ${idx}`, value: `opt_${Date.now().toString(36)}_${idx}` }] };
      })
    );
  }

  onContextOptionLabelChange(index: number, optIdx: number, newLabel: string): void {
    this.template.update(t =>
      updateContextField(t, index, field => ({
        ...field,
        options: (field.options ?? []).map((opt, i) => {
          if (i !== optIdx) return opt;
          // Une valeur technique auto-générée suit le libellé, pour rester lisible.
          const synced = !opt.value || opt.value.startsWith('opt_');
          const value = synced
            ? newLabel.trim().toLowerCase().replace(/[\s\W-]+/g, '_') || `opt_${Date.now().toString(36)}`
            : opt.value;
          return { label: newLabel, value };
        })
      }))
    );
  }

  removeContextFieldOption(index: number, optIdx: number): void {
    this.template.update(t =>
      updateContextField(t, index, field => ({ ...field, options: (field.options ?? []).filter((_, i) => i !== optIdx) }))
    );
  }

  // --- Gestion des sections ---
  addSection(): void {
    const t = this.template();
    // Dans un modèle déjà enchaîné, la nouvelle section suit la dernière de la liste.
    const dependsOn = newSectionDependencies(t);
    const newSection: ChecklistSectionTemplate = {
      id: `sec-${crypto.randomUUID()}`,
      title: `Nouvelle Section ${(t.sections || []).length + 1}`,
      icon: '',
      items: [],
      ...(dependsOn ? { dependsOn } : {})
    };
    this.template.update(cur => ({ ...cur, sections: [...(cur.sections || []), newSection] }));
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
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= this.template().sections.length) return;
    this.template.update(cur => ({ ...cur, sections: reorderArray(cur.sections, index, targetIndex) }));
  }

  onSectionDrop(event: CdkDragDrop<ChecklistSectionTemplate[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    this.template.update(cur => ({ ...cur, sections: reorderArray(cur.sections, event.previousIndex, event.currentIndex) }));
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
    this.template.update(t => addItem(t, section.id, newItem));
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
    this.template.update(t => insertItemAt(t, section.id, itemIndex + 1, copy));
    this.toastService.info(`Contrôle « ${copy.label} » dupliqué.`);
  }

  removeItem(section: ChecklistSectionTemplate, itemIndex: number): void {
    const removed = section.items[itemIndex];
    if (!removed) return;
    this.template.update(t => removeItemAt(t, section.id, itemIndex));

    this.toastService.showDeferred({
      message: `Contrôle « ${removed.label} » supprimé`,
      durationMs: 6000,
      undoLabel: 'Annuler',
      onCommit: () => {},
      onUndo: () => {
        this.template.update(t => insertItemAt(t, section.id, itemIndex, removed));
      }
    });
  }

  moveItem(section: ChecklistSectionTemplate, index: number, direction: 'up' | 'down'): void {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= section.items.length) return;
    this.template.update(t => moveItemWithin(t, section.id, index, targetIndex));
  }

  onItemDrop(event: CdkDragDrop<ChecklistItemTemplate[]>, targetSection: ChecklistSectionTemplate): void {
    // Les listes CDK sont liées aux tableaux du modèle courant : la section source se retrouve par identité.
    const source = this.template().sections.find(s => s.items === event.previousContainer.data);
    if (!source) return;
    if (source.id === targetSection.id && event.previousIndex === event.currentIndex) return;
    this.template.update(t => moveItemBetween(t, source.id, targetSection.id, event.previousIndex, event.currentIndex));
  }

  onControlTypeChange(item: ChecklistItemTemplate, type: ItemControlType): void {
    this.template.update(t =>
      updateItem(t, item.id, i =>
        type === 'choice' && (!i.customChoices || i.customChoices.length === 0)
          ? {
              ...i,
              controlType: type,
              customChoices: [
                { id: `opt-${crypto.randomUUID()}`, label: 'Option 1', tone: 'success' },
                { id: `opt-${crypto.randomUUID()}`, label: 'Option 2', tone: 'danger', isBlocking: true }
              ]
            }
          : { ...i, controlType: type }
      )
    );
  }

  addChoiceOption(item: ChecklistItemTemplate): void {
    this.template.update(t =>
      updateItem(t, item.id, i => ({
        ...i,
        customChoices: [
          ...(i.customChoices ?? []),
          { id: `opt-${crypto.randomUUID()}`, label: `Option ${(i.customChoices?.length ?? 0) + 1}`, tone: 'neutral', isBlocking: false }
        ]
      }))
    );
  }

  removeChoiceOption(item: ChecklistItemTemplate, index: number): void {
    this.template.update(t => updateItem(t, item.id, i => ({ ...i, customChoices: (i.customChoices ?? []).filter((_, k) => k !== index) })));
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
    this.template.update(t =>
      updateItem(t, item.id, i => {
        const { extraField: _extra, ...rest } = i;
        if (!enabled) return rest;
        return {
          ...rest,
          extraField: { id: `extra_${Date.now().toString(36)}`, label: 'Observation ou détail additionnel', placeholder: 'Saisissez ici...' }
        };
      })
    );
  }

  toggleVisibleIf(item: ChecklistItemTemplate, enabled: boolean): void {
    const firstField = (this.template().contextSchema || [])[0];
    this.template.update(t =>
      updateItem(t, item.id, i => {
        const { visibleIf: _condition, ...rest } = i;
        if (!enabled) return rest;
        const equals = firstField && firstField.type === 'select' && firstField.options?.[0] ? [firstField.options[0].value] : [];
        return { ...rest, visibleIf: { fieldId: firstField ? firstField.id : '', equals } };
      })
    );
  }

  /** Modifie la condition d'affichage d'un item (sans effet s'il n'en a pas). */
  private updateVisibleIf(itemId: string, change: (condition: VisibilityCondition) => VisibilityCondition): void {
    this.template.update(t => updateItem(t, itemId, i => (i.visibleIf ? { ...i, visibleIf: change(i.visibleIf) } : i)));
  }

  onVisibleIfFieldChange(item: ChecklistItemTemplate, fieldId: string): void {
    const field = (this.template().contextSchema || []).find(f => f.id === fieldId);
    const equals = field && field.type === 'select' && field.options && field.options.length > 0 ? [field.options[0].value] : [];
    this.updateVisibleIf(item.id, () => ({ fieldId, equals }));
  }

  isOptionSelectedInVisibleIf(item: ChecklistItemTemplate, val: string): boolean {
    return !!item.visibleIf?.equals?.includes(val);
  }

  toggleVisibleIfOption(item: ChecklistItemTemplate, val: string): void {
    this.updateVisibleIf(item.id, condition => {
      const current = condition.equals || [];
      return { ...condition, equals: current.includes(val) ? current.filter(v => v !== val) : [...current, val] };
    });
  }

  onVisibleIfTextChange(item: ChecklistItemTemplate, rawText: string): void {
    this.updateVisibleIf(item.id, condition => ({
      ...condition,
      equals: rawText
        .split(',')
        .map(v => v.trim())
        .filter(Boolean)
    }));
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

    // Copie horodatée : l'objet du signal n'est jamais modifié en place.
    const saved: ChecklistTemplate = { ...t, updatedAt: new Date().toISOString() };
    await this.templateService.saveTemplate(saved);
    this.template.set(saved);
    this.initialSnapshot.set(JSON.stringify(saved));
    this.toastService.success('Modèle enregistré avec succès.');
    this.router.navigate(['/templates']);
  }
}
