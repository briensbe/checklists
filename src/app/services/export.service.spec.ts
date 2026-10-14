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

  it('devrait exporter un draft JSON avec les détails complets des réponses', () => {
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

    const jsonStr = service.getJsonDraft();
    const parsed = JSON.parse(jsonStr);

    expect(parsed.templateName).toBe('Test Template Name');
    expect(parsed.contextValues.version).toBe('2026.4.0');
    expect(parsed.metrics).toBeDefined();

    // Vérification des détails des réponses
    expect(Array.isArray(parsed.details)).toBe(true);
    expect(parsed.details.length).toBe(1);

    const detailItem = parsed.details[0];
    expect(detailItem.sectionId).toBe('sec-1');
    expect(detailItem.sectionTitle).toBe('Section Qualité');
    expect(detailItem.itemId).toBe('item-1');
    expect(detailItem.label).toBe('Vérification SonarQube');
    expect(detailItem.help).toBe('Dette technique < 5%');
    expect(detailItem.status).toBe('KO');
    expect(detailItem.comment).toBe('Dette à 7%');
    expect(detailItem.extra).toEqual({ score: '7%' });

    // Vérification de la compatibilité answers
    expect(parsed.answers['item-1'].status).toBe('KO');
    expect(parsed.answers['item-1'].label).toBe('Vérification SonarQube');
    expect(parsed.answers['item-1'].sectionTitle).toBe('Section Qualité');
  });
});
