import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import Dexie from 'dexie';
import { TestBed } from '@angular/core/testing';
import { HINT_DURATION_MS, RunnerController } from './runner-controller';
import { ChecklistSessionService } from '../../services/checklist-session.service';
import { TemplateService } from '../../services/template.service';
import { AppDatabaseService } from '../../services/app-database.service';
import { EvidenceService } from '../../services/evidence.service';
import { ToastService } from '../../services/toast.service';
import { ChecklistTemplate } from '../../models/checklist.model';

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

const TEMPLATE: ChecklistTemplate = {
  id: 'tpl',
  name: 'Mise en production',
  description: '',
  version: '1',
  updatedAt: '2026-10-17T00:00:00.000Z',
  contextSchema: [],
  sections: [
    {
      id: 's1',
      title: 'Préparation',
      items: [
        { id: 'check', label: 'Ticket validé', controlType: 'checkbox' },
        { id: 'status', label: 'Créneau réservé' },
        {
          id: 'choice',
          label: 'Revue',
          controlType: 'choice',
          customChoices: [
            { id: 'go', label: 'Conforme', tone: 'success' },
            { id: 'stop', label: 'Non conforme', tone: 'danger', isBlocking: true }
          ]
        },
        { id: 'photo', label: 'Tests automatisés au vert', controlType: 'checkbox', criticality: 'blocking', evidenceRequired: 'photo' },
        { id: 'comment', label: 'Tests de charge', criticality: 'important', evidenceRequired: 'comment' }
      ]
    },
    {
      id: 's2',
      title: 'Build',
      items: [
        { id: 'b1', label: 'Build vert' },
        { id: 'b2', label: 'Version taggée', controlType: 'checkbox' }
      ]
    }
  ]
};

const png = (name = 'rapport.png') => new File(['png'], name, { type: 'image/png' });

describe('RunnerController', () => {
  let controller: RunnerController;
  let session: ChecklistSessionService;
  let evidence: EvidenceService;
  let toasts: ToastService;
  let db: AppDatabaseService;

  const answer = (itemId: string) => session.currentSession()!.answers[itemId];

  beforeEach(async () => {
    await Dexie.delete('ChecklistDatabase');
    TestBed.configureTestingModule({ providers: [RunnerController] });
    session = TestBed.inject(ChecklistSessionService);
    evidence = TestBed.inject(EvidenceService);
    toasts = TestBed.inject(ToastService);
    db = TestBed.inject(AppDatabaseService);
    const templates = TestBed.inject(TemplateService);
    await db.templates.put(TEMPLATE);
    templates.availableTemplates.set([TEMPLATE]);
    const created = await session.createSession('tpl', 'Audit');
    await evidence.loadEvidenceCounts(created.id);
    session.setFilter('all');
    session.collapsedSections.set({});
    toasts.clear();
    controller = TestBed.inject(RunnerController);
    TestBed.tick();
  });

  afterEach(async () => {
    vi.useRealTimers();
    toasts.clear();
    db.close();
    await Dexie.delete('ChecklistDatabase');
  });

  describe('geste principal', () => {
    it('Case à cocher : coche puis décoche', async () => {
      await controller.primary('check');
      expect(answer('check').checked).toBe(true);
      await controller.primary('check');
      expect(answer('check').checked).toBe(false);
    });

    it('Statut : OK, retrait du OK, correction d’un KO', async () => {
      await controller.primary('status');
      expect(answer('status').status).toBe('OK');
      await controller.primary('status');
      expect(answer('status').status).toBeNull();
      await controller.ko('status');
      await controller.primary('status');
      expect(answer('status').status).toBe('OK');
    });

    it('Choix et N/A : aucun effet', async () => {
      await controller.primary('choice');
      expect(answer('choice')).toBeUndefined();
      await controller.toggleNa('check');
      await controller.primary('check');
      expect(answer('check')).toMatchObject({ status: 'NA' });
      expect(answer('check').checked).toBeUndefined();
    });

    it('Session terminée : aucune réponse modifiée', async () => {
      session.currentSession.set({ ...session.currentSession()!, status: 'completed' });
      await controller.primary('check');
      await controller.ko('status');
      await controller.toggleNa('b1');
      expect(session.currentSession()!.answers).toEqual({});
    });
  });

  describe('mise en KO', () => {
    it('met en KO, ouvre le tiroir et demande le focus de la note ; un second KO retire le statut', async () => {
      await controller.ko('status');
      expect(answer('status').status).toBe('KO');
      expect(controller.drawerItemId()).toBe('status');
      expect(controller.drawerMode()).toBe('notes');
      expect(controller.noteFocusRequest()).toBe('status');

      await controller.ko('status');
      expect(answer('status').status).toBeNull();
    });

    it('n’existe pas pour une case à cocher', async () => {
      await controller.ko('check');
      expect(answer('check')).toBeUndefined();
      expect(controller.drawerItemId()).toBeNull();
    });
  });

  describe('preuve exigée', () => {
    it('Bloquant : demande de preuve, ni « Plus tard » ni validation sans photo, puis validation avec la photo', async () => {
      await controller.primary('photo');
      expect(controller.drawerItemId()).toBe('photo');
      expect(controller.drawerMode()).toBe('prompt');
      expect(answer('photo')).toBeUndefined();

      await controller.later();
      await controller.validatePrompt();
      expect(answer('photo')).toBeUndefined();
      expect(controller.drawerItemId()).toBe('photo');

      await controller.addFiles('photo', [png()]);
      expect(controller.isPromptSatisfied('photo')).toBe(true);
      await controller.validatePrompt();
      expect(answer('photo').checked).toBe(true);
      expect(controller.drawerItemId()).toBeNull();
    });

    it('Non bloquant : « Plus tard » pose la preuve en attente, « Compléter » la retire', async () => {
      await controller.primary('comment');
      await controller.later();
      expect(answer('comment')).toMatchObject({ status: 'OK', evidencePending: true });

      await controller.completeEvidence('comment');
      expect(controller.drawerMode()).toBe('prompt');
      controller.updateNote('comment', 'Charge max 300 req/s');
      await controller.validatePrompt();
      expect(answer('comment').evidencePending).toBeUndefined();
      expect(answer('comment').comment).toBe('Charge max 300 req/s');
    });

    it('Annuler ferme la demande sans répondre et garde les preuves ajoutées', async () => {
      await controller.primary('photo');
      await controller.addFiles('photo', [png()]);
      await controller.cancelPrompt();
      expect(answer('photo')?.checked).toBeFalsy();
      expect(controller.evidenceOf('photo').total).toBe(1);
      expect(controller.drawerItemId()).toBeNull();
    });

    it('Preuve déjà fournie : le geste répond directement', async () => {
      await controller.addFiles('photo', [png()]);
      await controller.primary('photo');
      expect(answer('photo').checked).toBe(true);
      expect(controller.drawerItemId()).toBeNull();
    });

    it('Une note terminée par Entrée qui fournit le commentaire exigé retire « preuve à compléter »', async () => {
      await controller.primary('comment');
      await controller.later();
      await controller.toggleDrawer('comment');
      controller.updateNote('comment', 'Résultats joints');
      await controller.noteCommitted('comment');
      expect(answer('comment').evidencePending).toBeUndefined();
    });

    it('Une photo ajoutée depuis le tiroir retire « preuve à compléter »', async () => {
      const t = structuredClone(TEMPLATE);
      t.sections[1].items[1].evidenceRequired = 'photo';
      session.currentSession.set({ ...session.currentSession()!, templateSnapshot: t });

      await controller.primary('b2');
      await controller.later();
      expect(answer('b2')).toMatchObject({ checked: true, evidencePending: true });

      await controller.toggleDrawer('b2');
      await controller.addFiles('b2', [png()]);
      expect(answer('b2').evidencePending).toBeUndefined();
    });

    it('Choix sans anomalie avec preuve exigée : la sélection attend la validation', async () => {
      const t = structuredClone(TEMPLATE);
      t.sections[0].items[2].evidenceRequired = 'comment';
      session.currentSession.set({ ...session.currentSession()!, templateSnapshot: t });

      await controller.choose('choice', 'go');
      expect(controller.drawerMode()).toBe('prompt');
      expect(controller.promptChoiceId()).toBe('go');
      expect(answer('choice')).toBeUndefined();

      controller.updateNote('choice', 'Revue faite avec le PO');
      await controller.validatePrompt();
      expect(answer('choice').selectedChoice).toBe('go');

      await controller.choose('choice', 'stop');
      expect(answer('choice').selectedChoice).toBe('stop');
    });
  });

  describe('suppression de preuve annulable', () => {
    it('masque la preuve, ajoute l’événement, puis l’annulation restaure la preuve et retire l’événement', async () => {
      await controller.toggleDrawer('check');
      await controller.addFiles('check', [png()]);
      const record = controller.drawerEvidences()[0];
      const historyBefore = structuredClone(answer('check').history);

      await controller.deleteEvidence(record);
      expect(controller.drawerEvidences()).toEqual([]);
      expect(controller.evidenceOf('check').total).toBe(0);
      expect(answer('check').history?.at(-1)?.kind).toBe('evidence-removed');

      await toasts.toasts()[0].action!.run();
      expect(controller.drawerEvidences().map(e => e.id)).toEqual([record.id]);
      expect(controller.evidenceOf('check').total).toBe(1);
      expect(answer('check').history).toEqual(historyBefore);
      expect(await db.evidences.count()).toBe(1);
    });

    it('exécute les suppressions en attente avant une clôture', async () => {
      await controller.toggleDrawer('check');
      await controller.addFiles('check', [png()]);
      await controller.deleteEvidence(controller.drawerEvidences()[0]);

      await controller.flushEvidenceDeletions();
      expect(await db.evidences.count()).toBe(0);
      expect(toasts.toasts()).toEqual([]);
      expect(controller.drawerEvidences()).toEqual([]);
    });

    it('refuse un fichier de plus de 50 Mo par un toast et ajoute les autres', async () => {
      const big = new File(['x'], 'enorme.zip');
      Object.defineProperty(big, 'size', { value: 51 * 1024 * 1024 });
      await controller.addFiles('check', [big, png()]);
      expect(controller.evidenceOf('check').total).toBe(1);
      expect(toasts.toasts().some(t => t.tone === 'warning' && t.message.includes('enorme.zip'))).toBe(true);
    });
  });

  describe('navigation et item actif', () => {
    it('désigne le premier contrôle affiché au chargement et navigue sans dépasser les extrémités', () => {
      expect(controller.activeItemId()).toBe('check');
      controller.navigate(-1);
      expect(controller.activeItemId()).toBe('check');
      controller.navigate(1);
      expect(controller.activeItemId()).toBe('status');
    });

    it('Item actif qui sort du filtre : le suivant devient actif', async () => {
      session.setFilter('pending');
      TestBed.tick();
      controller.setActive('check');
      await controller.primary('check');
      TestBed.tick();
      expect(controller.activeItemId()).toBe('status');
    });

    it('garde affiché le contrôle dont le tiroir est ouvert, malgré le filtre', async () => {
      session.setFilter('pending');
      await controller.ko('status');
      TestBed.tick();
      expect(controller.visibleIds()).toContain('status');

      await controller.closeDrawer();
      TestBed.tick();
      expect(controller.visibleIds()).not.toContain('status');
    });

    it('Prochain item à traiter : déplie la section et repasse le filtre à « Tous »', async () => {
      for (const id of ['check', 'status', 'choice', 'photo', 'comment']) {
        await session.toggleNa(id);
      }
      session.toggleSection('s2');
      session.setFilter('ko');
      TestBed.tick();

      expect(controller.nextToProcess()?.id).toBe('b1');
      controller.goToNext();
      expect(session.activeFilter()).toBe('all');
      expect(session.collapsedSections()['s2']).toBe(false);
      expect(controller.activeItemId()).toBe('b1');
    });

    it('exécute les raccourcis sur l’item actif', async () => {
      controller.setActive('status');
      await controller.handleShortcut('primary');
      expect(answer('status').status).toBe('OK');
      await controller.handleShortcut('na');
      expect(answer('status').status).toBe('NA');
      await controller.handleShortcut('drawer');
      expect(controller.drawerItemId()).toBe('status');
      expect(await controller.handleShortcut('escape')).toBe(true);
      expect(controller.drawerItemId()).toBeNull();
      expect(await controller.handleShortcut('escape')).toBe(false);
      await controller.handleShortcut('help');
      expect(controller.helpOpen()).toBe(true);
    });
  });

  describe('suggestion d’ajout', () => {
    it('met en évidence le trombone environ 2 s après une coche sans note ni preuve', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      await controller.primary('check');
      expect(controller.hintItemId()).toBe('check');
      await vi.advanceTimersByTimeAsync(HINT_DURATION_MS);
      expect(controller.hintItemId()).toBeNull();
    });

    it('ne suggère rien pour un contrôle qui a déjà une preuve', async () => {
      await controller.addFiles('b2', [png()]);
      await controller.primary('b2');
      expect(controller.hintItemId()).toBeNull();
    });
  });
});
