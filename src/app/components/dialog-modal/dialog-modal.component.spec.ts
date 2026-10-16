import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DialogModalComponent } from './dialog-modal.component';
import { DialogService } from '../../services/dialog.service';

describe('DialogModalComponent', () => {
  let component: DialogModalComponent;
  let fixture: ComponentFixture<DialogModalComponent>;
  let dialogService: DialogService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DialogModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(DialogModalComponent);
    component = fixture.componentInstance;
    dialogService = TestBed.inject(DialogService);
    fixture.detectChanges();
  });

  it('ne devrait rien afficher si aucun dialogue actif', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.dialog-backdrop')).toBeNull();
  });

  it('devrait afficher la boîte de confirmation lors de l’appel de confirm()', async () => {
    dialogService.confirm({
      title: 'Suppression',
      message: 'Êtes-vous sûr ?',
      confirmLabel: 'Oui, supprimer',
      cancelLabel: 'Non'
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const backdrop = el.querySelector('.dialog-backdrop');
    expect(backdrop).not.toBeNull();

    const title = el.querySelector('#dialog-modal-title');
    expect(title?.textContent).toContain('Suppression');

    const msg = el.querySelector('#dialog-modal-message');
    expect(msg?.textContent).toContain('Êtes-vous sûr ?');

    const buttons = el.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3); // close, cancel, confirm
  });

  it('devrait fermer le dialogue lors de l’appui sur Échap', () => {
    let resolvedValue: boolean | undefined;
    dialogService.confirm({
      title: 'Test Escape',
      message: 'Fermer avec échap'
    }).then(val => {
      resolvedValue = val;
    });
    fixture.detectChanges();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(dialogService.activeDialog()).toBeNull();
  });
});
