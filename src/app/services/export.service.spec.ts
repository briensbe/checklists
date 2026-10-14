import { TestBed } from '@angular/core/testing';
import { ExportService } from './export.service';
import { ChecklistSessionService } from './checklist-session.service';
import { EvidenceService } from './evidence.service';

describe('ExportService', () => {
  let service: ExportService;
  let sessionService: ChecklistSessionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ExportService, ChecklistSessionService, EvidenceService]
    });
    service = TestBed.inject(ExportService);
    sessionService = TestBed.inject(ChecklistSessionService);
  });

  it('devrait être initialisé', () => {
    expect(service).toBeTruthy();
  });

  it('devrait produire l’aperçu du fichier d’échange ré-importable', () => {
    // Mock template (copie figée portée par la session)
    const template = {
      id: 'test-template',
      name: 'Test Template Name',
      description: 'Description',
      version: '1.0.0',
      updatedAt: '2026-10-10T00:00:00Z',
      contextSchema: [],
      sections: [
        {
          id: 'sec-1',
          title: 'Section Qualité',
          items: [
            {
              id: 'item-1',
              label: 'Vérification SonarQube',
              help: 'Dette technique < 5%'
            }
          ]
        }
      ]
    };

    // Mock session answers
    sessionService.currentSession.set({
      id: 'current',
      title: 'Audit Test Qualité',
      templateId: 'test-template',
      templateSnapshot: template,
      status: 'in_progress',
      closures: [],
      contextValues: { version: '2026.4.0' },
      answers: {
        'item-1': {
          status: 'KO',
          comment: 'Dette à 7%',
          extra: { score: '7%' }
        }
      },
      createdAt: '2026-10-10T00:00:00Z',
      updatedAt: '2026-10-10T01:00:00Z'
    });

    const parsed = JSON.parse(service.getExchangePreview());

    // Enveloppe versionnée, session complète (copie figée comprise), synthèse lisible
    expect(parsed.format).toBe('checklist-session');
    expect(parsed.formatVersion).toBe(1);
    expect(parsed.session.templateSnapshot).toEqual(template);
    expect(parsed.session.status).toBe('in_progress');
    expect(parsed.session.contextValues.version).toBe('2026.4.0');
    expect(parsed.session.answers['item-1']).toEqual({ status: 'KO', comment: 'Dette à 7%', extra: { score: '7%' } });
    expect(parsed.summary.templateName).toBe('Test Template Name');
    expect(parsed.summary.metrics.koCount).toBe(1);
    // Pièces jointes non demandées : pas de bloc de preuves
    expect('evidences' in parsed).toBe(false);
  });
});
