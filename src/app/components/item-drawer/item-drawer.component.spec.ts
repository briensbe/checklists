import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ItemDrawerComponent } from './item-drawer.component';
import { RunnerController } from '../../pages/checklist-runner/runner-controller';
import { ChecklistSessionService } from '../../services/checklist-session.service';
import { EvidenceService } from '../../services/evidence.service';
import { ToastService } from '../../services/toast.service';
import { ChecklistItemTemplate, ChecklistSession, EvidenceRecord, ItemAnswer } from '../../models/checklist.model';

const ITEMS: ChecklistItemTemplate[] = [
  { id: 'note', label: 'Créneau réservé' },
  { id: 'blocking', label: 'Tests au vert', controlType: 'checkbox', criticality: 'blocking', evidenceRequired: 'photo', evidenceHint: 'Capture du rapport de tests' },
  { id: 'important', label: 'Tests de charge', criticality: 'important', evidenceRequired: 'comment' },
  { id: 'link', label: 'Doc API', evidenceRequired: 'link' }
];

const SESSION: ChecklistSession = {
  id: 'sess',
  title: 'Audit',
  templateId: 'tpl',
  templateSnapshot: {
    id: 'tpl',
    name: 'Audit',
    description: '',
    version: '1',
    updatedAt: '2026-10-17T00:00:00.000Z',
    contextSchema: [],
    sections: [{ id: 's1', title: 'Section', items: ITEMS }]
  },
  status: 'in_progress',
  closures: [],
  contextValues: {},
  answers: {},
  createdAt: '2026-10-17T00:00:00.000Z',
  updatedAt: '2026-10-17T00:00:00.000Z'
};

const RECORD: EvidenceRecord = {
  id: 'ev-1',
  sessionId: 'sess',
  itemId: 'note',
  name: 'rapport.pdf',
  type: 'file',
  mimeType: 'application/pdf',
  size: 2048,
  blob: new Blob(['pdf']),
  createdAt: '2026-10-17T10:00:00.000Z'
};

describe('ItemDrawerComponent', () => {
  let fixture: ComponentFixture<ItemDrawerComponent>;
  let controller: RunnerController;
  let session: ChecklistSessionService;
  let evidence: EvidenceService;

  const el = (): HTMLElement => fixture.nativeElement;
  const open = async (itemId: string, mode: 'notes' | 'prompt', answer?: ItemAnswer, readonly = false) => {
    await controller.openDrawer(itemId, mode);
    fixture.componentRef.setInput('item', ITEMS.find(i => i.id === itemId)!);
    fixture.componentRef.setInput('answer', answer);
    fixture.componentRef.setInput('readonly', readonly);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItemDrawerComponent],
      providers: [RunnerController]
    }).compileComponents();

    session = TestBed.inject(ChecklistSessionService);
    evidence = TestBed.inject(EvidenceService);
    session.currentSession.set(structuredClone(SESSION));
    vi.spyOn(evidence, 'getEvidencesForItem').mockResolvedValue([]);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preuve');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    controller = TestBed.inject(RunnerController);
    fixture = TestBed.createComponent(ItemDrawerComponent);
  });

  describe('note', () => {
    it('Entrée termine la saisie, Maj+Entrée va à la ligne', async () => {
      await open('note', 'notes');
      const committed = vi.spyOn(controller, 'noteCommitted').mockResolvedValue();
      const note = el().querySelector('textarea')!;

      note.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
      expect(committed).not.toHaveBeenCalled();
      note.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      expect(committed).toHaveBeenCalledWith('note');
    });

    it('Échap rétablit la note d’origine et ne remonte pas jusqu’au runner', async () => {
      await open('note', 'notes', { status: null, comment: 'Procédure dans le wiki' });
      // Pas d'écriture réelle : elle ouvrirait une connexion IndexedDB après la fin du test.
      const update = vi.spyOn(controller, 'updateNote').mockImplementation(() => {});
      const note = el().querySelector('textarea')!;
      note.dispatchEvent(new FocusEvent('focus'));
      note.value = 'Autre chose';

      const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      const reachedDocument = vi.fn();
      document.addEventListener('keydown', reachedDocument);
      note.dispatchEvent(escape);
      document.removeEventListener('keydown', reachedDocument);

      expect(note.value).toBe('Procédure dans le wiki');
      expect(update).toHaveBeenLastCalledWith('note', 'Procédure dans le wiki');
      expect(reachedDocument).not.toHaveBeenCalled();
    });

    it('signale la justification obligatoire d’un KO vide', async () => {
      await open('note', 'notes', { status: 'KO', comment: '' });
      expect(el().querySelector('.field-label')?.textContent).toContain('obligatoire');
      expect(el().querySelector('textarea')?.classList.contains('error-required')).toBe(true);
    });
  });

  describe('demande de preuve', () => {
    it('Bloquant : consigne, « Valider » désactivé, pas de « Plus tard », explication', async () => {
      await open('blocking', 'prompt');
      expect(el().querySelector('.prompt-hint')?.textContent).toContain('Capture du rapport de tests');
      const buttons = [...el().querySelectorAll('.prompt-actions button')].map(b => b.textContent?.trim());
      expect(buttons).toEqual(['Valider', 'Annuler']);
      expect((el().querySelector('.prompt-actions .btn-primary') as HTMLButtonElement).disabled).toBe(true);
      expect(el().querySelector('.prompt-blocking')?.textContent).toContain('nécessaire');
    });

    it('Non bloquant : « Plus tard » est proposé', async () => {
      await open('important', 'prompt');
      const buttons = [...el().querySelectorAll('.prompt-actions button')].map(b => b.textContent?.trim());
      expect(buttons).toEqual(['Valider', 'Plus tard', 'Annuler']);
    });

    it('Lien : refuse une adresse non http(s), accepte une adresse https', async () => {
      await open('link', 'prompt');
      const input = el().querySelector<HTMLInputElement>('input[type="url"]')!;
      input.value = 'ftp://serveur/doc';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(el().querySelector('.field-error')?.textContent).toContain('http ou https');
      expect((el().querySelector('.prompt-actions .btn-primary') as HTMLButtonElement).disabled).toBe(true);

      input.value = 'https://wiki.example.org/api';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(el().querySelector('.field-error')).toBeNull();
      expect((el().querySelector('.prompt-actions .btn-primary') as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe('lien de preuve et lecture seule', () => {
    it('affiche un lien sûr comme lien externe, un lien non sûr comme texte', async () => {
      await open('link', 'notes', { status: 'OK', comment: '', evidenceLink: 'https://wiki.example.org/api' });
      const link = el().querySelector<HTMLAnchorElement>('.link-row a')!;
      expect(link.target).toBe('_blank');
      expect(link.rel).toBe('noopener noreferrer');

      fixture.componentRef.setInput('answer', { status: 'OK', comment: '', evidenceLink: 'javascript:alert(1)' });
      fixture.detectChanges();
      expect(el().querySelector('.link-row a')).toBeNull();
      expect(el().querySelector('.link-unsafe')?.textContent).toContain('javascript:alert(1)');
    });

    it('Session terminée : note en lecture seule, preuves téléchargeables, aucune commande de saisie', async () => {
      vi.mocked(evidence.getEvidencesForItem).mockResolvedValue([RECORD]);
      await open('note', 'notes', { status: 'OK', comment: 'Vérifié' }, true);
      expect(el().querySelector('textarea')?.readOnly).toBe(true);
      expect(el().querySelector('a[download]')?.getAttribute('download')).toBe('rapport.pdf');
      expect(el().querySelector('.btn-danger')).toBeNull();
      expect(el().querySelector('.toolbar')).toBeNull();
      expect(el().textContent).toContain('Session terminée');
    });
  });

  it('refuse un fichier de plus de 50 Mo par un toast d’avertissement', async () => {
    await open('note', 'notes');
    const warning = vi.spyOn(TestBed.inject(ToastService), 'warning');
    const big = new File(['x'], 'trop_lourd.zip');
    Object.defineProperty(big, 'size', { value: 51 * 1024 * 1024 });

    fixture.componentInstance.onFileInput({ target: { files: [big], value: '' } } as unknown as Event);
    await Promise.resolve();
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('trop_lourd.zip'));
  });
});
