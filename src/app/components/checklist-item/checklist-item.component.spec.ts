import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChecklistItemComponent } from './checklist-item.component';
import { ChecklistItemTemplate } from '../../models/checklist.model';

describe('ChecklistItemComponent', () => {
  let component: ChecklistItemComponent;
  let fixture: ComponentFixture<ChecklistItemComponent>;

  const defaultItem: ChecklistItemTemplate = {
    id: 'item-default',
    label: 'Test contrôle standard (N/A facultatif)'
  };

  const itemWithRequiredNa: ChecklistItemTemplate = {
    id: 'item-required-na',
    label: 'Test contrôle strict (N/A obligatoire)',
    requireNaReason: true
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChecklistItemComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ChecklistItemComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('item', defaultItem);
    fixture.detectChanges();
  });

  it('devrait être instancié avec succès', () => {
    expect(component).toBeTruthy();
    expect(component.requireNaReason()).toBe(false);
  });

  it('ne doit PAS ouvrir la boîte de commentaire si statut N/A par défaut sur le template', () => {
    fixture.componentRef.setInput('item', defaultItem);
    fixture.componentRef.setInput('answer', { status: 'NA', comment: '' });
    fixture.detectChanges();

    expect(component.isCommentBoxVisible()).toBe(false);
    const commentBox = fixture.nativeElement.querySelector('.comment-box');
    expect(commentBox).toBeNull();
  });

  it('DOIT ouvrir la boîte de commentaire et exiger le motif si requireNaReason = true sur le template', () => {
    fixture.componentRef.setInput('item', itemWithRequiredNa);
    fixture.componentRef.setInput('answer', { status: 'NA', comment: '' });
    fixture.detectChanges();

    expect(component.requireNaReason()).toBe(true);
    expect(component.isCommentBoxVisible()).toBe(true);
    const commentBox = fixture.nativeElement.querySelector('.comment-box');
    expect(commentBox).not.toBeNull();

    const input = fixture.nativeElement.querySelector('.comment-input');
    expect(input.classList.contains('error-required')).toBe(true);
  });

  it('doit toujours ouvrir la boîte de commentaire si statut KO quel que soit le template', () => {
    fixture.componentRef.setInput('item', defaultItem);
    fixture.componentRef.setInput('answer', { status: 'KO', comment: '' });
    fixture.detectChanges();

    expect(component.isCommentBoxVisible()).toBe(true);
    const input = fixture.nativeElement.querySelector('.comment-input');
    expect(input.classList.contains('error-required')).toBe(true);
  });
});
