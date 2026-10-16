import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditSummaryComponent } from './audit-summary.component';
import { ChecklistTemplate, MetricsSummary } from '../../models/checklist.model';

describe('AuditSummaryComponent', () => {
  let component: AuditSummaryComponent;
  let fixture: ComponentFixture<AuditSummaryComponent>;

  const mockMetrics: MetricsSummary = {
    total: 10,
    answered: 6,
    okCount: 4,
    koCount: 1,
    naCount: 1,
    pending: 4,
    percent: 60
  };

  const mockTemplate: ChecklistTemplate = {
    id: 'tmpl-1',
    name: 'Template de test',
    version: '1.0.0',
    description: 'Description',
    updatedAt: new Date().toISOString(),
    contextSchema: [
      { id: 'env', label: 'Environnement', type: 'select', options: [{ label: 'Prod', value: 'prod' }, { label: 'Preprod', value: 'preprod' }] },
      { id: 'date_audit', label: 'Date d\'audit', type: 'date', required: true }
    ],
    sections: []
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditSummaryComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(AuditSummaryComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('metrics', mockMetrics);
    fixture.componentRef.setInput('template', mockTemplate);
    fixture.detectChanges();
  });

  it('devrait être instancié avec succès', () => {
    expect(component).toBeTruthy();
  });

  it('devrait émettre contextChange lors de la saisie d\'une variable de contexte', () => {
    const spy = vi.spyOn(component.contextChange, 'emit');
    const inputEvent = { target: { value: '2026-10-15' } } as unknown as Event;

    component.onContextChange('date_audit', inputEvent);
    expect(spy).toHaveBeenCalledWith({ key: 'date_audit', value: '2026-10-15' });
  });

  it('devrait afficher les champs de contexte du modèle dans le DOM', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const labels = compiled.querySelectorAll('.field-label');
    expect(labels.length).toBe(2);
    expect(labels[0].textContent).toContain('Environnement');
    expect(labels[1].textContent).toContain('Date d\'audit');
  });
});
