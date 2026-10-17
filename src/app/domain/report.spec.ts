import {
  contextFieldValue,
  formatDateTime,
  formatIsoDate,
  itemObservations,
  itemStateText,
  NOT_FILLED,
  reportHeaderFields
} from './report';
import { ChecklistItemTemplate, ChecklistSession, ChecklistTemplate } from '../models/checklist.model';

/** Template sans aucun des champs historiques version / mode / responsible / date. */
const TEMPLATE: ChecklistTemplate = {
  id: 'tpl-cloud',
  name: 'Déploiement cloud',
  description: '',
  version: '3.2',
  updatedAt: '2026-10-01T00:00:00.000Z',
  contextSchema: [
    { id: 'env', label: 'Environnement', type: 'select', options: [{ label: 'Production', value: 'prod' }, { label: 'Recette', value: 'rec' }] },
    { id: 'go', label: 'Date de mise en service', type: 'date' },
    { id: 'owner', label: 'Pilote', type: 'text' }
  ],
  sections: []
};

function session(overrides: Partial<ChecklistSession> = {}): ChecklistSession {
  return {
    id: 's',
    title: 'Audit',
    templateId: TEMPLATE.id,
    templateSnapshot: TEMPLATE,
    status: 'in_progress',
    closures: [],
    contextValues: { env: 'prod', go: '2026-10-14', owner: '' },
    answers: {},
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides
  };
}

describe('report', () => {
  describe('cartouche', () => {
    it('suit le schéma de contexte de la copie figée, sans clé codée en dur', () => {
      expect(reportHeaderFields(session())).toEqual([
        { label: 'Modèle', value: 'Déploiement cloud' },
        { label: 'Version du modèle', value: '3.2' },
        { label: 'Statut', value: 'En cours' },
        { label: 'Environnement', value: 'Production' },
        { label: 'Date de mise en service', value: '14/10/2026' },
        { label: 'Pilote', value: NOT_FILLED }
      ]);
    });

    it('indique la date de la dernière clôture d’une session terminée, réouvertures comprises', () => {
      const closures = [
        { closedAt: '2026-10-10T08:00:00.000Z', reopenedAt: '2026-10-11T08:00:00.000Z' },
        { closedAt: '2026-10-12T15:30:00.000Z' }
      ];
      const fields = reportHeaderFields(session({ status: 'completed', closures }));
      expect(fields[2]).toEqual({ label: 'Statut', value: 'Terminée' });
      expect(fields[3]).toEqual({ label: 'Clôturée le', value: formatDateTime('2026-10-12T15:30:00.000Z') });
    });

    it('n’affiche pas de date de clôture pour une session rouverte', () => {
      const fields = reportHeaderFields(session({ closures: [{ closedAt: '2026-10-10T08:00:00.000Z', reopenedAt: '2026-10-11T08:00:00.000Z' }] }));
      expect(fields.map(f => f.label)).not.toContain('Clôturée le');
    });
  });

  describe('valeurs de contexte', () => {
    it('formate une date sans décalage de fuseau', () => {
      expect(formatIsoDate('2026-01-01')).toBe('01/01/2026');
      expect(contextFieldValue({ id: 'd', label: 'D', type: 'date' }, '2026-01-01')).toBe('01/01/2026');
    });

    it('retombe sur la valeur brute pour une option inconnue', () => {
      expect(contextFieldValue(TEMPLATE.contextSchema[0], 'dev')).toBe('dev');
    });

    it('affiche « Non renseigné » pour une valeur vide ou absente', () => {
      expect(contextFieldValue(TEMPLATE.contextSchema[2], '  ')).toBe(NOT_FILLED);
      expect(contextFieldValue(TEMPLATE.contextSchema[2], undefined)).toBe(NOT_FILLED);
    });
  });

  describe('état et observations d’un item', () => {
    const choiceItem: ChecklistItemTemplate = {
      id: 'c',
      label: 'Choix',
      controlType: 'choice',
      customChoices: [{ id: 'opt-1', label: 'Conforme', tone: 'success' }]
    };

    it('affiche le libellé du choix sélectionné par identifiant', () => {
      expect(itemStateText(choiceItem, { status: null, comment: '', selectedChoice: 'opt-1' })).toBe('Conforme');
    });

    it('retombe sur la valeur stockée pour une ancienne réponse par libellé', () => {
      expect(itemStateText(choiceItem, { status: null, comment: '', selectedChoice: 'Ancien libellé' })).toBe('Ancien libellé');
    });

    it('couvre les autres types de contrôle', () => {
      expect(itemStateText(choiceItem, undefined)).toBe('NON SÉLECTIONNÉ');
      expect(itemStateText({ id: 'x', label: 'X' }, { status: 'NA', comment: '' })).toBe('N/A');
      expect(itemStateText({ id: 'x', label: 'X' }, undefined)).toBe('À TRAITER');
      expect(itemStateText({ id: 'k', label: 'K', controlType: 'checkbox' }, { status: null, comment: '', checked: true })).toBe('FAIT');
      expect(itemStateText({ id: 'k', label: 'K', controlType: 'checkbox' }, undefined)).toBe('NON FAIT');
    });

    it('préfixe le champ additionnel de son libellé', () => {
      const item: ChecklistItemTemplate = { id: 'i', label: 'I', extraField: { id: 'score', label: 'Score Sonar' } };
      expect(itemObservations(item, { status: 'KO', comment: 'Dette à 7%', extra: { score: '7%' } }, ' | ')).toBe(
        'Dette à 7% | Score Sonar : 7%'
      );
      expect(itemObservations(item, undefined, ' | ')).toBe('');
    });

    it('affiche N/A pour une case à cocher ou un choix non applicable', () => {
      const na = { status: 'NA' as const, comment: '' };
      expect(itemStateText({ id: 'k', label: 'K', controlType: 'checkbox' }, na)).toBe('N/A');
      expect(itemStateText(choiceItem, na)).toBe('N/A');
    });

    it('signale une preuve à compléter', () => {
      const item: ChecklistItemTemplate = { id: 'k', label: 'K', controlType: 'checkbox' };
      expect(itemStateText(item, { status: null, comment: '', checked: true, evidencePending: true })).toBe(
        'FAIT · preuve à compléter'
      );
    });

    it('reprend le lien de preuve après le commentaire', () => {
      const item: ChecklistItemTemplate = { id: 'i', label: 'I' };
      expect(
        itemObservations(item, { status: 'OK', comment: 'Doc publiée', evidenceLink: 'https://wiki.example.org/api' }, ' | ')
      ).toBe('Doc publiée | Lien de preuve : https://wiki.example.org/api');
    });
  });
});
