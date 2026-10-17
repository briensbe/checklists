import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChecklistItemComponent } from './checklist-item.component';
import { RunnerController } from '../../pages/checklist-runner/runner-controller';
import { ChecklistSessionService } from '../../services/checklist-session.service';
import { ChecklistItemTemplate, ChecklistSession, ItemAnswer } from '../../models/checklist.model';

const ITEMS: ChecklistItemTemplate[] = [
  { id: 'status', label: 'Créneau réservé' },
  { id: 'check', label: 'Ticket validé', controlType: 'checkbox', criticality: 'blocking' },
  {
    id: 'choice',
    label: 'Revue',
    controlType: 'choice',
    criticality: 'important',
    customChoices: [
      { id: 'go', label: 'Conforme', tone: 'success' },
      { id: 'stop', label: 'Non conforme', tone: 'danger', isBlocking: true }
    ]
  },
  { id: 'photo', label: 'Tests au vert', controlType: 'checkbox', evidenceRequired: 'photo', criticality: 'important' }
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

describe('ChecklistItemComponent', () => {
  let fixture: ComponentFixture<ChecklistItemComponent>;
  let controller: RunnerController;
  let session: ChecklistSessionService;

  const el = (): HTMLElement => fixture.nativeElement;
  const render = (itemId: string, answer?: ItemAnswer, readonly = false) => {
    fixture.componentRef.setInput('item', ITEMS.find(i => i.id === itemId)!);
    fixture.componentRef.setInput('answer', answer);
    fixture.componentRef.setInput('readonly', readonly);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChecklistItemComponent],
      providers: [RunnerController]
    }).compileComponents();

    session = TestBed.inject(ChecklistSessionService);
    session.currentSession.set(structuredClone(SESSION));
    controller = TestBed.inject(RunnerController);
    fixture = TestBed.createComponent(ChecklistItemComponent);
  });

  describe('rôle et état annoncés', () => {
    it('Case à cocher : role="checkbox" et aria-checked', () => {
      render('check', { status: null, comment: '', checked: true });
      const main = el().querySelector('.item-main')!;
      expect(main.getAttribute('role')).toBe('checkbox');
      expect(main.getAttribute('aria-checked')).toBe('true');
      expect(main.id).toBe('item-check');
    });

    it('Statut : un bouton dont le nom contient l’état', () => {
      render('status', { status: 'KO', comment: 'cassé' });
      const main = el().querySelector('.item-main')!;
      expect(main.getAttribute('role')).toBe('button');
      expect(main.textContent).toContain('état : KO');
    });

    it('Choix : un groupe nommé, des boutons pressés', () => {
      render('choice', { status: null, comment: '', selectedChoice: 'go' });
      expect(el().querySelector('.item-main')!.getAttribute('role')).toBe('group');
      const pressed = [...el().querySelectorAll('.btn-choice')].map(b => b.getAttribute('aria-pressed'));
      expect(pressed).toEqual(['true', 'false']);
    });

    it('Trombone : aria-label nommant le contrôle et aria-expanded', () => {
      render('status');
      const drawerBtn = el().querySelector('.btn-drawer')!;
      expect(drawerBtn.getAttribute('aria-label')).toBe('Note et preuves : Créneau réservé');
      expect(drawerBtn.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('geste principal sur la ligne', () => {
    it('un clic sur le libellé déclenche le geste principal', () => {
      const primary = vi.spyOn(controller, 'primary').mockResolvedValue();
      render('status');
      (el().querySelector('.item-label') as HTMLElement).click();
      expect(primary).toHaveBeenCalledWith('status');
    });

    it('un clic sur le bouton KO ou le trombone ne déclenche pas le geste principal', () => {
      const primary = vi.spyOn(controller, 'primary').mockResolvedValue();
      const ko = vi.spyOn(controller, 'ko').mockResolvedValue();
      const toggle = vi.spyOn(controller, 'toggleDrawer').mockResolvedValue();
      render('status');
      (el().querySelector('.btn-ko') as HTMLElement).click();
      (el().querySelector('.btn-drawer') as HTMLElement).click();
      expect(primary).not.toHaveBeenCalled();
      expect(ko).toHaveBeenCalledWith('status');
      expect(toggle).toHaveBeenCalledWith('status');
    });

    it('un clic qui termine une sélection de texte ne répond pas', () => {
      const primary = vi.spyOn(controller, 'primary').mockResolvedValue();
      const selection = vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'Créneau' } as Selection);
      render('status');
      (el().querySelector('.item-label') as HTMLElement).click();
      expect(primary).not.toHaveBeenCalled();
      selection.mockRestore();
    });

    it('Session terminée : un clic ne modifie pas la réponse et aucune commande de saisie n’est proposée', async () => {
      session.currentSession.set({ ...structuredClone(SESSION), status: 'completed' });
      render('status', undefined, true);
      (el().querySelector('.item-label') as HTMLElement).click();
      await Promise.resolve();
      expect(session.currentSession()!.answers).toEqual({});
      expect(el().querySelector('.btn-ko')).toBeNull();
    });
  });

  describe('N/A, badges, compteurs, preuve exigée', () => {
    it('affiche « Non applicable » et désactive les choix d’un contrôle N/A', () => {
      render('choice', { status: 'NA', comment: '' });
      expect(el().textContent).toContain('Non applicable');
      expect([...el().querySelectorAll('.btn-choice')].every(b => (b as HTMLButtonElement).disabled)).toBe(true);
    });

    it('n’affiche que les badges « bloquant » et « important », et « anomalie » pour un choix', () => {
      render('check');
      expect(el().querySelector('.criticality-badge.is-blocking')?.textContent).toContain('bloquant');
      render('status');
      expect(el().querySelector('.criticality-badge')).toBeNull();
      render('choice');
      expect(el().querySelector('.criticality-badge.is-important')?.textContent).toContain('important');
      expect(el().querySelector('.btn-choice.is-anomaly .choice-anomaly')?.textContent).toContain('anomalie');
    });

    it('affiche l’indicateur de note et le nombre de preuves, tiroir fermé', () => {
      vi.spyOn(controller, 'evidenceOf').mockReturnValue({ total: 2, images: 1 });
      render('status', { status: 'OK', comment: 'Vérifié' });
      const counters = [...el().querySelectorAll('.counter')].map(c => c.textContent ?? '');
      expect(counters.length).toBe(2);
      expect(counters[1]).toContain('2');
    });

    it('signale « preuve à compléter » avec « Compléter », et « preuve manquante »', () => {
      render('photo', { status: null, comment: '', checked: true, evidencePending: true });
      expect(el().querySelector('.evidence-pending')?.textContent).toContain('preuve à compléter');
      const complete = vi.spyOn(controller, 'completeEvidence').mockResolvedValue();
      (el().querySelector('.evidence-pending .btn-link') as HTMLElement).click();
      expect(complete).toHaveBeenCalledWith('photo');

      render('photo', { status: null, comment: '', checked: true });
      expect(el().querySelector('.evidence-missing')?.textContent).toContain('Preuve manquante');
    });
  });
});
