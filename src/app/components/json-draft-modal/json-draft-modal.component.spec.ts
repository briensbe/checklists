import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JsonDraftModalComponent } from './json-draft-modal.component';

describe('JsonDraftModalComponent', () => {
  let component: JsonDraftModalComponent;
  let fixture: ComponentFixture<JsonDraftModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JsonDraftModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(JsonDraftModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('jsonContent', '{\n  "version": "1.0.0"\n}');
    fixture.componentRef.setInput('filename', 'test-audit.json');
    fixture.detectChanges();
  });

  it('devrait être créé avec succès', () => {
    expect(component).toBeTruthy();
  });

  it('devrait calculer le nombre de lignes et la taille formatée', () => {
    expect(component.lineCount()).toBe(3);
    expect(component.formattedSize()).toContain('o');
  });

  it('devrait afficher le nom de fichier et le contenu JSON dans le template', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('test-audit.json');
    expect(el.querySelector('.json-code code')?.textContent).toContain('"version": "1.0.0"');
  });

  it('devrait émettre exportFile lors du clic sur le bouton exporter', () => {
    let emitted = false;
    component.exportFile.subscribe(() => {
      emitted = true;
    });

    const exportBtn = fixture.nativeElement.querySelector('.btn-export-file') as HTMLButtonElement;
    exportBtn.click();

    expect(emitted).toBe(true);
  });

  it('devrait émettre close lors du clic sur le bouton fermer', () => {
    let emitted = false;
    component.close.subscribe(() => {
      emitted = true;
    });

    const closeBtn = fixture.nativeElement.querySelector('.btn-close') as HTMLButtonElement;
    closeBtn.click();

    expect(emitted).toBe(true);
  });

  it('devrait copier le contenu dans le presse-papier lors du clic sur copier', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextSpy
      },
      configurable: true
    });

    const copyBtn = fixture.nativeElement.querySelector('.btn-copy') as HTMLButtonElement;
    copyBtn.click();
    await fixture.whenStable();

    expect(writeTextSpy).toHaveBeenCalledWith('{\n  "version": "1.0.0"\n}');
    expect(component.isCopied()).toBe(true);
  });
});
