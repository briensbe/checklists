import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EvidenceAttachmentComponent } from './evidence-attachment.component';
import { ToastService } from '../../services/toast.service';

describe('EvidenceAttachmentComponent', () => {
  let component: EvidenceAttachmentComponent;
  let fixture: ComponentFixture<EvidenceAttachmentComponent>;
  let toastService: ToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EvidenceAttachmentComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(EvidenceAttachmentComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('itemId', 'item-1');
    fixture.componentRef.setInput('itemLabel', 'Point de contrôle 1');
    fixture.componentRef.setInput('evidences', []);

    toastService = TestBed.inject(ToastService);
    toastService.clear();
    fixture.detectChanges();
  });

  it('devrait afficher un toast d’avertissement sans alert() lorsqu’un fichier dépasse 50 Mo', () => {
    const warningSpy = vi.spyOn(toastService, 'warning');

    const bigFile = new File(['x'], 'trop_lourd.zip', { type: 'application/octet-stream' });
    Object.defineProperty(bigFile, 'size', { value: 51 * 1024 * 1024 });

    const fileInputEvent = {
      target: {
        files: [bigFile],
        value: ''
      }
    } as unknown as Event;

    component.onFileSelected(fileInputEvent);

    expect(warningSpy).toHaveBeenCalledWith(expect.stringContaining('trop_lourd.zip'));
  });
});
