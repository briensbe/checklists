import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ToastContainerComponent } from './toast-container.component';
import { ToastService } from '../../services/toast.service';

describe('ToastContainerComponent', () => {
  let component: ToastContainerComponent;
  let fixture: ComponentFixture<ToastContainerComponent>;
  let toastService: ToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastContainerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ToastContainerComponent);
    component = fixture.componentInstance;
    toastService = TestBed.inject(ToastService);
    toastService.clear();
    fixture.detectChanges();
  });

  it('ne devrait rien afficher si aucun toast', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.toast-wrapper')).toBeNull();
  });

  it('devrait afficher les toasts ajoutés avec leur message et action', () => {
    let actionTriggered = false;
    toastService.show({
      message: 'Item supprimé',
      tone: 'success',
      action: {
        label: 'Annuler',
        run: () => {
          actionTriggered = true;
        }
      }
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const cards = el.querySelectorAll('.toast-card');
    expect(cards.length).toBe(1);

    const message = el.querySelector('.toast-message');
    expect(message?.textContent).toContain('Item supprimé');

    const actionBtn = el.querySelector<HTMLButtonElement>('.toast-action-btn');
    expect(actionBtn?.textContent).toContain('Annuler');

    actionBtn?.click();
    expect(actionTriggered).toBe(true);
  });
});
