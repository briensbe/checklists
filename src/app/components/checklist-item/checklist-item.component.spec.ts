import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChecklistItemComponent } from './checklist-item.component';
import { ChecklistItemTemplate } from '../../models/checklist.model';

describe('ChecklistItemComponent', () => {
  let component: ChecklistItemComponent;
  let fixture: ComponentFixture<ChecklistItemComponent>;

  const defaultItem: ChecklistItemTemplate = {
    id: 'item-default',
    label: 'Test contrôle standard'
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
  });

  it('ne doit PAS ouvrir la boîte de commentaire pour un N/A : aucun motif n’est jamais exigé', () => {
    fixture.componentRef.setInput('item', defaultItem);
    fixture.componentRef.setInput('answer', { status: 'NA', comment: '' });
    fixture.detectChanges();

    expect(component.isCommentBoxVisible()).toBe(false);
    const commentBox = fixture.nativeElement.querySelector('.comment-box');
    expect(commentBox).toBeNull();
  });

  it('affiche un motif N/A facultatif, sans erreur, quand la boîte est ouverte', () => {
    fixture.componentRef.setInput('answer', { status: 'NA', comment: '' });
    component.toggleCommentBox();
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('.comment-label');
    expect(label.textContent).toContain('Motif N/A (optionnel)');
    const input = fixture.nativeElement.querySelector('.comment-input');
    expect(input.classList.contains('error-required')).toBe(false);
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
