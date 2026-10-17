import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { TemplateBuilderComponent } from './template-builder.component';
import { TemplateService } from '../../services/template.service';
import { ToastService } from '../../services/toast.service';
import { DialogService } from '../../services/dialog.service';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ChecklistItemTemplate, ChecklistSectionTemplate } from '../../models/checklist.model';

describe('TemplateBuilderComponent', () => {
  let component: TemplateBuilderComponent;
  let fixture: ComponentFixture<TemplateBuilderComponent>;
  let templateService: TemplateService;
  let toastService: ToastService;
  let dialogService: DialogService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TemplateBuilderComponent],
      providers: [provideRouter([])]
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

  it('devrait gérer l\'ajout et la suppression des variables de contexte', async () => {
    expect(component.template().contextSchema.length).toBe(0);

    component.addContextField();
    expect(component.template().contextSchema.length).toBe(1);

    const field = component.template().contextSchema[0];
    expect(field.label).toBe('Champ 1');
    expect(field.type).toBe('text');

    component.onContextFieldTypeChange(field, 'select');
    expect(field.type).toBe('select');
    expect(field.options?.length).toBe(2);

    component.addContextFieldOption(field);
    expect(field.options?.length).toBe(3);

    component.removeContextFieldOption(field, 2);
    expect(field.options?.length).toBe(2);

    await component.removeContextField(0);
    expect(component.template().contextSchema.length).toBe(0);
  });

  it('devrait alerter via DialogService si l\'on supprime un champ de contexte référencé par un visibleIf', async () => {
    component.addContextField();
    const fieldId = component.template().contextSchema[0].id;

    // Attacher une condition visibleIf sur le premier item
    const sec = component.template().sections[0];
    sec.items[0].visibleIf = { fieldId, equals: ['val1'] };

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
    const sec = component.template().sections[0];
    expect(sec.items.length).toBe(1);

    component.duplicateItem(sec, 0);
    expect(sec.items.length).toBe(2);
    expect(sec.items[0].id).not.toBe(sec.items[1].id);
    expect(sec.items[1].label).toBe(sec.items[0].label);
  });

  it('devrait basculer et configurer les options avancées d\'un item', () => {
    const sec = component.template().sections[0];
    const item = sec.items[0];

    expect(component.isAdvancedOpen(item.id)).toBe(false);
    component.toggleAdvanced(item.id);
    expect(component.isAdvancedOpen(item.id)).toBe(true);

    // extraField
    expect(item.extraField).toBeUndefined();
    component.toggleExtraField(item, true);
    expect(item.extraField).toBeDefined();
    expect(item.extraField?.label).toContain('Observation');
    component.toggleExtraField(item, false);
    expect(item.extraField).toBeUndefined();

    // visibleIf
    expect(item.visibleIf).toBeUndefined();
    component.toggleVisibleIf(item, true);
    expect(item.visibleIf).toBeDefined();

    component.onVisibleIfTextChange(item, 'valA, valB');
    expect(item.visibleIf?.equals).toEqual(['valA', 'valB']);

    component.toggleVisibleIfOption(item, 'valC');
    expect(item.visibleIf?.equals).toContain('valC');
    component.toggleVisibleIfOption(item, 'valC');
    expect(item.visibleIf?.equals).not.toContain('valC');

    component.toggleVisibleIf(item, false);
    expect(item.visibleIf).toBeUndefined();
  });

  it('devrait bloquer l\'enregistrement si des doublons d\'identifiants existent', async () => {
    const warningSpy = vi.spyOn(toastService, 'warning');
    const saveSpy = vi.spyOn(templateService, 'saveTemplate');

    const sec = component.template().sections[0];
    sec.items.push({ id: sec.items[0].id, label: 'Item avec même ID' });

    await component.save();

    expect(warningSpy).toHaveBeenCalledWith(expect.stringContaining('en doublon'));
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('devrait bloquer l\'enregistrement si un visibleIf pointe vers un champ de contexte inexistant', async () => {
    const warningSpy = vi.spyOn(toastService, 'warning');
    const saveSpy = vi.spyOn(templateService, 'saveTemplate');

    const sec = component.template().sections[0];
    sec.items[0].visibleIf = { fieldId: 'champ_fantome', equals: ['test'] };

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
    const sec1 = component.template().sections[0];
    component.addItem(sec1);
    expect(sec1.items.length).toBe(2);
    const item1 = sec1.items[0];
    const item2 = sec1.items[1];

    // Reorder intra-section
    const container = { data: sec1.items };
    const intraDrop = {
      previousContainer: container,
      container: container,
      previousIndex: 0,
      currentIndex: 1
    } as unknown as CdkDragDrop<ChecklistItemTemplate[]>;

    component.onItemDrop(intraDrop, sec1);
    expect(sec1.items[0].id).toBe(item2.id);
    expect(sec1.items[1].id).toBe(item1.id);

    // Transfer inter-sections
    component.addSection();
    const sec2 = component.template().sections[1];
    expect(sec2.items.length).toBe(0);

    const targetContainer = { data: sec2.items };
    const interDrop = {
      previousContainer: { data: sec1.items },
      container: targetContainer,
      previousIndex: 0,
      currentIndex: 0
    } as unknown as CdkDragDrop<ChecklistItemTemplate[]>;

    component.onItemDrop(interDrop, sec2);
    expect(sec1.items.length).toBe(1);
    expect(sec2.items.length).toBe(1);
  });

  it('devrait formater lisiblement les libellés de contexte et synchroniser les options', () => {
    component.addContextField();
    const field = component.template().contextSchema[0];
    field.label = 'Environnement cible';
    component.onContextFieldTypeChange(field, 'select');

    // Vérification du label lisible
    expect(component.getContextFieldLabel(field.id)).toBe('Environnement cible');
    expect(component.getContextFieldLabel('inconnu')).toBe('inconnu');

    // Synchronisation du libellé d'option
    const opt = field.options![0];
    component.onContextOptionLabelChange(opt, 'Production France');
    expect(opt.label).toBe('Production France');
    expect(opt.value).toBe('production_france');

    // Formatage de la condition visibleIf
    const item = component.template().sections[0].items[0];
    item.visibleIf = { fieldId: field.id, equals: ['production_france'] };
    expect(component.formatVisibleIfValues(item)).toBe('Production France');
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
