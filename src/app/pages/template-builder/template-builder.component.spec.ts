import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter, Router } from '@angular/router';
import { TemplateBuilderComponent } from './template-builder.component';
import { provideStepIcons } from '../../components/step-graph/step-icons';
import { TemplateService } from '../../services/template.service';
import { ToastService } from '../../services/toast.service';
import { DialogService } from '../../services/dialog.service';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ChecklistItemTemplate, ChecklistSectionTemplate, ChecklistTemplate } from '../../models/checklist.model';

describe('TemplateBuilderComponent', () => {
  let component: TemplateBuilderComponent;
  let fixture: ComponentFixture<TemplateBuilderComponent>;
  let templateService: TemplateService;
  let toastService: ToastService;
  let dialogService: DialogService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TemplateBuilderComponent],
      providers: [provideRouter([]), provideStepIcons()]
    }).compileComponents();

    fixture = TestBed.createComponent(TemplateBuilderComponent);
    component = fixture.componentInstance;
    templateService = TestBed.inject(TemplateService);
    toastService = TestBed.inject(ToastService);
    dialogService = TestBed.inject(DialogService);
    toastService.clear();

    vi.spyOn(templateService, 'initTemplates').mockResolvedValue();
    fixture.detectChanges();
  });

  it('devrait supprimer une section avec toast d’annulation et pouvoir la restaurer', async () => {
    expect(component.template().sections.length).toBe(1);

    component.removeSection(0);
    expect(component.template().sections.length).toBe(0);
    expect(toastService.toasts().length).toBe(1);

    const toast = toastService.toasts()[0];
    await toast.action?.run();

    expect(component.template().sections.length).toBe(1);
  });

  it('devrait retirer une section supprimée des dépendances des autres et tout restaurer à l’annulation', async () => {
    const sections: ChecklistSectionTemplate[] = [
      { id: 'prep', title: 'Préparation', items: [{ id: 'i1', label: 'Ticket' }] },
      { id: 'build', title: 'Build', dependsOn: ['prep'], items: [{ id: 'i2', label: 'Build vert' }] },
      { id: 'go', title: 'Go', dependsOn: ['build', 'prep'], items: [{ id: 'i3', label: 'Go' }] }
    ];
    component.template.update(cur => ({ ...cur, sections }));

    component.removeSection(0);
    expect(component.template().sections.map(s => [s.id, s.dependsOn])).toEqual([
      ['build', []],
      ['go', ['build']]
    ]);

    await toastService.toasts()[0].action?.run();
    expect(component.template().sections.map(s => s.id)).toEqual(['prep', 'build', 'go']);
    expect(component.template().sections[1].dependsOn).toEqual(['prep']);
    expect(component.template().sections[2].dependsOn).toEqual(expect.arrayContaining(['build', 'prep']));
  });

  it('devrait afficher un toast d’avertissement si le nom du modèle est vide lors de la sauvegarde', async () => {
    const warningSpy = vi.spyOn(toastService, 'warning');
    const saveSpy = vi.spyOn(templateService, 'saveTemplate');

    component.template.update(t => ({ ...t, name: '   ' }));
    await component.save();

    expect(warningSpy).toHaveBeenCalledWith(expect.stringContaining('nom pour le modèle'));
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('devrait détecter correctement les modifications (isDirty)', () => {
    expect(component.isDirty()).toBe(false);

    component.template.update(t => ({ ...t, name: 'Nom modifié' }));
    expect(component.isDirty()).toBe(true);

    component.template.update(t => ({ ...t, name: 'Nouveau modèle' }));
    expect(component.isDirty()).toBe(false);
  });

  describe('détection des modifications imbriquées', () => {
    /** Saisit une valeur dans un champ du formulaire, comme le ferait l'utilisateur. */
    async function typeInto(selector: string, value: string): Promise<void> {
      fixture.detectChanges();
      await fixture.whenStable();
      const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }

    it('signale la modification du seul libellé d’un contrôle, puis son retour à l’état initial', async () => {
      const original = component.template().sections[0].items[0].label;
      expect(component.isDirty()).toBe(false);

      await typeInto('.item-label-input', 'Libellé modifié');
      expect(component.template().sections[0].items[0].label).toBe('Libellé modifié');
      expect(component.isDirty()).toBe(true);

      await typeInto('.item-label-input', original);
      expect(component.isDirty()).toBe(false);
    });

    /** Prépare une zone du formulaire, la marque comme état initial, puis y saisit une valeur. */
    async function editZone(prepare: () => void, selector: string, value: string): Promise<void> {
      prepare();
      component.initialSnapshot.set(JSON.stringify(component.template()));
      expect(component.isDirty()).toBe(false);
      await typeInto(selector, value);
      expect(component.isDirty()).toBe(true);
    }

    async function savedTemplate() {
      const saveSpy = vi.spyOn(templateService, 'saveTemplate').mockImplementation(async t => t);
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      await component.save();
      expect(saveSpy).toHaveBeenCalledTimes(1);
      return saveSpy.mock.calls[0][0];
    }

    it('détecte la modification du libellé d’un champ de contexte et l’enregistre', async () => {
      await editZone(() => component.addContextField(), '.context-field-row input.form-input', 'Environnement');
      expect((await savedTemplate()).contextSchema[0].label).toBe('Environnement');
    });

    it('détecte la modification du libellé d’un choix et l’enregistre', async () => {
      await editZone(() => component.onControlTypeChange(component.template().sections[0].items[0], 'choice'), '.choice-label-input', 'Conforme');
      expect((await savedTemplate()).sections[0].items[0].customChoices?.[0].label).toBe('Conforme');
    });

    it('détecte la modification d’une option avancée et l’enregistre', async () => {
      await editZone(
        () => {
          const item = component.template().sections[0].items[0];
          component.toggleExtraField(item, true);
          component.toggleAdvanced(item.id);
        },
        '.extra-field-config input.form-input',
        'Version constatée'
      );
      expect((await savedTemplate()).sections[0].items[0].extraField?.label).toBe('Version constatée');
    });

    it('détecte la modification du titre d’une section et l’enregistre', async () => {
      await editZone(() => undefined, '.section-title-input', 'Préparation');
      expect((await savedTemplate()).sections[0].title).toBe('Préparation');
    });
  });

  it('devrait gérer l\'ajout et la suppression des variables de contexte', async () => {
    expect(component.template().contextSchema.length).toBe(0);

    component.addContextField();
    expect(component.template().contextSchema.length).toBe(1);

    const field = () => component.template().contextSchema[0];
    expect(field().label).toBe('Champ 1');
    expect(field().type).toBe('text');

    component.onContextFieldTypeChange(0, 'select');
    expect(field().type).toBe('select');
    expect(field().options?.length).toBe(2);

    component.addContextFieldOption(0);
    expect(field().options?.length).toBe(3);

    component.removeContextFieldOption(0, 2);
    expect(field().options?.length).toBe(2);

    await component.removeContextField(0);
    expect(component.template().contextSchema.length).toBe(0);
  });

  it('devrait alerter via DialogService si l\'on supprime un champ de contexte référencé par un visibleIf', async () => {
    component.addContextField();
    const fieldId = component.template().contextSchema[0].id;

    // Attacher une condition visibleIf sur le premier item
    component.patchItem(component.template().sections[0].items[0].id, { visibleIf: { fieldId, equals: ['val1'] } });

    const confirmSpy = vi.spyOn(dialogService, 'confirm').mockResolvedValue(false);

    // Tentative de suppression refusée
    await component.removeContextField(0);
    expect(confirmSpy).toHaveBeenCalledWith(expect.objectContaining({ title: 'Champ de contexte utilisé' }));
    expect(component.template().contextSchema.length).toBe(1);

    // Tentative de suppression confirmée
    confirmSpy.mockResolvedValueOnce(true);
    await component.removeContextField(0);
    expect(component.template().contextSchema.length).toBe(0);
  });

  it('devrait dupliquer une section et ses items avec de nouveaux identifiants', () => {
    expect(component.template().sections.length).toBe(1);
    const initialSecId = component.template().sections[0].id;
    const initialItemId = component.template().sections[0].items[0].id;

    component.duplicateSection(0);
    expect(component.template().sections.length).toBe(2);

    const duplicateSec = component.template().sections[1];
    expect(duplicateSec.id).not.toBe(initialSecId);
    expect(duplicateSec.title).toContain('(copie)');
    expect(duplicateSec.items[0].id).not.toBe(initialItemId);
  });

  it('devrait dupliquer un item au sein d\'une section', () => {
    const sec = () => component.template().sections[0];
    expect(sec().items.length).toBe(1);

    component.duplicateItem(sec(), 0);
    expect(sec().items.length).toBe(2);
    expect(sec().items[0].id).not.toBe(sec().items[1].id);
    expect(sec().items[1].label).toBe(sec().items[0].label);
  });

  it('devrait basculer et configurer les options avancées d\'un item', () => {
    const item = () => component.template().sections[0].items[0];

    expect(component.isAdvancedOpen(item().id)).toBe(false);
    component.toggleAdvanced(item().id);
    expect(component.isAdvancedOpen(item().id)).toBe(true);

    // extraField
    expect(item().extraField).toBeUndefined();
    component.toggleExtraField(item(), true);
    expect(item().extraField).toBeDefined();
    expect(item().extraField?.label).toContain('Observation');
    component.toggleExtraField(item(), false);
    expect('extraField' in item()).toBe(false);

    // visibleIf
    expect(item().visibleIf).toBeUndefined();
    component.toggleVisibleIf(item(), true);
    expect(item().visibleIf).toBeDefined();

    component.onVisibleIfTextChange(item(), 'valA, valB');
    expect(item().visibleIf?.equals).toEqual(['valA', 'valB']);

    component.toggleVisibleIfOption(item(), 'valC');
    expect(item().visibleIf?.equals).toContain('valC');
    component.toggleVisibleIfOption(item(), 'valC');
    expect(item().visibleIf?.equals).not.toContain('valC');

    component.toggleVisibleIf(item(), false);
    expect('visibleIf' in item()).toBe(false);
  });

  it('devrait bloquer l\'enregistrement si des doublons d\'identifiants existent', async () => {
    const warningSpy = vi.spyOn(toastService, 'warning');
    const saveSpy = vi.spyOn(templateService, 'saveTemplate');

    const sec = component.template().sections[0];
    component.addItem(sec);
    component.patchItem(component.template().sections[0].items[1].id, { id: sec.items[0].id });

    await component.save();

    expect(warningSpy).toHaveBeenCalledWith(expect.stringContaining('en doublon'));
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('devrait bloquer l\'enregistrement si un visibleIf pointe vers un champ de contexte inexistant', async () => {
    const warningSpy = vi.spyOn(toastService, 'warning');
    const saveSpy = vi.spyOn(templateService, 'saveTemplate');

    component.patchItem(component.template().sections[0].items[0].id, { visibleIf: { fieldId: 'champ_fantome', equals: ['test'] } });

    await component.save();

    expect(warningSpy).toHaveBeenCalledWith(expect.stringContaining('champ de contexte inexistant'));
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('devrait réordonner les sections lors de onSectionDrop', () => {
    component.addSection();
    expect(component.template().sections.length).toBe(2);
    const sec1 = component.template().sections[0];
    const sec2 = component.template().sections[1];

    const mockDropEvent = {
      previousIndex: 0,
      currentIndex: 1
    } as CdkDragDrop<ChecklistSectionTemplate[]>;

    component.onSectionDrop(mockDropEvent);
    expect(component.template().sections[0].id).toBe(sec2.id);
    expect(component.template().sections[1].id).toBe(sec1.id);
  });

  it('devrait réordonner ou transférer les items lors de onItemDrop', () => {
    const sec = (index: number) => component.template().sections[index];
    component.addItem(sec(0));
    expect(sec(0).items.length).toBe(2);
    const [item1, item2] = sec(0).items;

    // Réordonnancement dans la section : les listes CDK portent les tableaux du modèle courant.
    const container = { data: sec(0).items };
    const intraDrop = {
      previousContainer: container,
      container: container,
      previousIndex: 0,
      currentIndex: 1
    } as unknown as CdkDragDrop<ChecklistItemTemplate[]>;

    component.onItemDrop(intraDrop, sec(0));
    expect(sec(0).items.map(i => i.id)).toEqual([item2.id, item1.id]);
    expect(container.data.map(i => i.id)).toEqual([item1.id, item2.id]);

    // Transfert vers une autre section
    component.addSection();
    expect(sec(1).items.length).toBe(0);

    const interDrop = {
      previousContainer: { data: sec(0).items },
      container: { data: sec(1).items },
      previousIndex: 0,
      currentIndex: 0
    } as unknown as CdkDragDrop<ChecklistItemTemplate[]>;

    component.onItemDrop(interDrop, sec(1));
    expect(sec(0).items.map(i => i.id)).toEqual([item1.id]);
    expect(sec(1).items.map(i => i.id)).toEqual([item2.id]);
  });

  it('devrait formater lisiblement les libellés de contexte et synchroniser les options', () => {
    component.addContextField();
    const field = () => component.template().contextSchema[0];
    component.patchContextField(0, { label: 'Environnement cible' });
    component.onContextFieldTypeChange(0, 'select');

    // Vérification du label lisible
    expect(component.getContextFieldLabel(field().id)).toBe('Environnement cible');
    expect(component.getContextFieldLabel('inconnu')).toBe('inconnu');

    // Synchronisation du libellé d'option
    component.onContextOptionLabelChange(0, 0, 'Production France');
    expect(field().options![0]).toEqual({ label: 'Production France', value: 'production_france' });

    // Formatage de la condition visibleIf
    const itemId = component.template().sections[0].items[0].id;
    component.patchItem(itemId, { visibleIf: { fieldId: field().id, equals: ['production_france'] } });
    expect(component.formatVisibleIfValues(component.template().sections[0].items[0])).toBe('Production France');
  });

  describe('enchaînement des étapes', () => {
    /** Modèle chargé comme depuis la bibliothèque : il devient l'état initial. */
    function load(template: ChecklistTemplate): void {
      component.template.set(structuredClone(template));
      component.initialSnapshot.set(JSON.stringify(component.template()));
      fixture.detectChanges();
    }

    const flowTemplate = (): ChecklistTemplate => ({
      id: 'flow',
      name: 'Mise en production',
      description: '',
      version: '1.0.0',
      updatedAt: '',
      contextSchema: [],
      sections: [
        { id: 'prep', title: 'Préparation', icon: 'circle-stack', items: [{ id: 'p1', label: 'Ticket', criticality: 'blocking' }] },
        { id: 'build', title: 'Build', icon: 'hammer', dependsOn: ['prep'], items: [{ id: 'b1', label: 'Build vert', criticality: 'blocking' }] },
        { id: 'tests', title: 'Tests', dependsOn: ['build'], items: [{ id: 't1', label: 'Recette' }] }
      ]
    });

    const nodeLabels = () =>
      [...fixture.nativeElement.querySelectorAll('app-flow-preview g.node')].map((n: Element) => n.getAttribute('aria-label')!.split(' :')[0]);

    async function savedTemplate(): Promise<ChecklistTemplate> {
      const saveSpy = vi.spyOn(templateService, 'saveTemplate').mockImplementation(async t => t);
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      await component.save();
      return saveSpy.mock.calls[0][0];
    }

    it('crée un nouveau modèle en « Seuls les bloquants », sans le signaler modifié', async () => {
      await fixture.whenStable();
      fixture.detectChanges();
      expect(component.template().completionPolicy).toBe('blocking');
      expect(component.isDirty()).toBe(false);
      const checked = fixture.nativeElement.querySelector('input[name="completion-policy"]:checked') as HTMLInputElement;
      expect(checked.value).toBe('blocking');
    });

    it('n’écrit pas de politique de clôture dans un modèle existant qui n’en a pas, sauf changement', async () => {
      load(flowTemplate());
      const checked = fixture.nativeElement.querySelector('input[name="completion-policy"]:checked') as HTMLInputElement;
      expect(checked.value).toBe('all');
      expect(component.isDirty()).toBe(false);
      expect('completionPolicy' in (await savedTemplate())).toBe(false);
    });

    it('signale et enregistre un changement de politique de clôture', async () => {
      load(flowTemplate());
      (fixture.nativeElement.querySelector('input[name="completion-policy"][value="blocking"]') as HTMLInputElement).click();
      expect(component.isDirty()).toBe(true);
      expect((await savedTemplate()).completionPolicy).toBe('blocking');
    });

    it('fait dépendre une nouvelle section de la dernière dans un modèle enchaîné, d’aucune sinon', () => {
      load(flowTemplate());
      component.addSection();
      expect(component.template().sections[3].dependsOn).toEqual(['tests']);

      load({ ...flowTemplate(), sections: flowTemplate().sections.map(({ dependsOn: _d, ...s }) => s) });
      component.addSection();
      expect('dependsOn' in component.template().sections[3]).toBe(false);
    });

    it('réordonne et duplique les sections sans toucher aux dépendances', () => {
      load(flowTemplate());
      const deps = () => Object.fromEntries(component.template().sections.map(s => [s.id, s.dependsOn ?? []]));
      const before = deps();

      component.moveSection(2, 'up');
      component.onSectionDrop({ previousIndex: 0, currentIndex: 2 } as CdkDragDrop<ChecklistSectionTemplate[]>);
      expect(component.template().sections.map(s => s.id)).toEqual(['tests', 'build', 'prep']);
      expect(deps()).toEqual(before);

      component.duplicateSection(1);
      const copy = component.template().sections[2];
      expect(copy.dependsOn).toEqual(['prep']);
      expect(component.template().sections.some(s => s.dependsOn?.includes(copy.id))).toBe(false);
    });

    it('grise la puce qui créerait une boucle et applique une puce cliquée', () => {
      load(flowTemplate());
      const chips = (sectionId: string) =>
        [...fixture.nativeElement.querySelectorAll(`#section-${sectionId} .dep-chip`)] as HTMLButtonElement[];
      expect(chips('prep').map(c => [c.textContent!.trim(), c.disabled])).toEqual([
        ['Build', true],
        ['Tests', true]
      ]);

      chips('tests').find(c => c.textContent!.trim() === 'Préparation')!.click();
      fixture.detectChanges();
      expect(component.template().sections[2].dependsOn).toEqual(['build', 'prep']);
      expect(component.isDirty()).toBe(true);
    });

    it('redessine l’aperçu quand une section est renommée', async () => {
      load(flowTemplate());
      expect(nodeLabels()).toEqual(['Préparation', 'Build', 'Tests']);
      const title = fixture.nativeElement.querySelector('#section-build .section-title-input') as HTMLInputElement;
      title.value = 'Compilation';
      title.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(nodeLabels()).toEqual(['Préparation', 'Compilation', 'Tests']);
    });

    it('amène la section choisie dans l’aperçu et donne le focus à son titre', () => {
      document.body.appendChild(fixture.nativeElement);
      try {
        load(flowTemplate());
        const node = [...fixture.nativeElement.querySelectorAll('app-flow-preview g.node')].find((n: Element) =>
          n.getAttribute('aria-label')!.startsWith('Tests :')
        ) as SVGGElement;
        node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        expect(document.activeElement).toBe(fixture.nativeElement.querySelector('#section-tests .section-title-input'));
      } finally {
        fixture.nativeElement.remove();
      }
    });

    it('conserve une icône Heroicons tant qu’aucune icône n’est choisie, puis écrit le choix', async () => {
      load(flowTemplate());
      const trigger = fixture.nativeElement.querySelector('#section-prep .icon-trigger') as HTMLButtonElement;
      expect(trigger.querySelector('svg.lucide-database')).not.toBeNull();
      expect((await savedTemplate()).sections[0].icon).toBe('circle-stack');

      component.onIconPick('prep', 'clipboard-list');
      expect(component.template().sections[0].icon).toBe('clipboard-list');
    });
  });

  describe('criticité et preuve exigée', () => {
    it('crée un nouvel item en case à cocher optionnelle, valeurs écrites explicitement', () => {
      expect(component.template().sections[0].items[0]).toMatchObject({ controlType: 'checkbox', criticality: 'optional' });
      component.addItem(component.template().sections[0]);
      const added = component.template().sections[0].items[1];
      expect(added).toMatchObject({ controlType: 'checkbox', criticality: 'optional' });
      expect(added.evidenceRequired).toBeUndefined();
    });

    it('fait tourner la criticité au clic sur la pastille', () => {
      fixture.detectChanges();
      const chip = () => fixture.nativeElement.querySelector('.criticality-chip') as HTMLButtonElement;
      expect(chip().textContent?.trim()).toBe('optionnel');
      expect(chip().getAttribute('aria-label')).toContain('Criticité : optionnel');

      const seen: string[] = [];
      for (let i = 0; i < 3; i++) {
        chip().click();
        fixture.detectChanges();
        seen.push(component.template().sections[0].items[0].criticality ?? '');
      }
      expect(seen).toEqual(['blocking', 'important', 'optional']);
    });

    it('enregistre la preuve exigée et sa consigne, puis les retire avec « aucune »', () => {
      const item = () => component.template().sections[0].items[0];
      component.onEvidenceKindChange(item(), 'photo');
      component.onEvidenceHintChange(item(), 'Capture du rapport de tests');
      expect(item()).toMatchObject({ evidenceRequired: 'photo', evidenceHint: 'Capture du rapport de tests' });

      component.onEvidenceKindChange(item(), '');
      expect('evidenceRequired' in item()).toBe(false);
      expect('evidenceHint' in item()).toBe(false);
    });

    it('libelle « Anomalie » l’option isBlocking d’un choix', () => {
      const item = component.template().sections[0].items[0];
      component.onControlTypeChange(item, 'choice');
      component.template.update(t => ({ ...t }));
      fixture.detectChanges();
      const labels = [...fixture.nativeElement.querySelectorAll('.choice-blocking span')].map((s: Element) => s.textContent?.trim());
      expect(labels).toEqual(['Anomalie', 'Anomalie']);
    });

    it('affiche dans l’aperçu les badges de criticité et la preuve exigée', () => {
      component.template.update(t => ({
        ...t,
        sections: [
          {
            id: 's1',
            title: 'Section',
            items: [
              { id: 'a', label: 'Doc API', criticality: 'blocking', evidenceRequired: 'link' },
              { id: 'b', label: 'FAQ', criticality: 'optional' }
            ]
          }
        ]
      }));
      component.previewMode.set(true);
      fixture.detectChanges();
      const items = [...fixture.nativeElement.querySelectorAll('.preview-item')] as HTMLElement[];
      expect(items[0].querySelector('.criticality-badge')?.textContent).toContain('bloquant');
      expect(items[0].querySelector('.preview-badge-evidence')?.textContent).toContain('Preuve exigée : lien');
      expect(items[1].querySelector('.criticality-badge')).toBeNull();
    });
  });
});
