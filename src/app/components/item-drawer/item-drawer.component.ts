import {
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild
} from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  LucideCamera,
  LucideCircleOff,
  LucideDownload,
  LucideFile,
  LucideImage,
  LucideLink,
  LucideMessageSquare,
  LucideTrash,
  LucideX
} from '@lucide/angular';
import { ChecklistItemTemplate, EvidenceRecord, ItemAnswer } from '../../models/checklist.model';
import { criticalityOf } from '../../domain/session-rules';
import { isSafeHttpUrl } from '../../domain/quick-check';
import { DrawerMode, RunnerController } from '../../pages/checklist-runner/runner-controller';

const KIND_HINTS: Record<NonNullable<ChecklistItemTemplate['evidenceRequired']>, string> = {
  comment: 'Un commentaire est exigé pour valider ce contrôle.',
  photo: 'Une photo est exigée pour valider ce contrôle.',
  link: 'Un lien est exigé pour valider ce contrôle.',
  file: 'Un fichier est exigé pour valider ce contrôle.'
};

/**
 * Tiroir d'un contrôle, affiché sous sa ligne. Mode `notes` : note, preuves et N/A ; mode `prompt` :
 * demande de la preuve exigée par le modèle (consigne, saisie, Valider / Plus tard / Annuler).
 * Il remplace la fenêtre modale des preuves et en reprend le collage, le glisser-déposer et la limite de 50 Mo.
 */
@Component({
  selector: 'app-item-drawer',
  standalone: true,
  imports: [
    DatePipe,
    LucideCamera,
    LucideCircleOff,
    LucideDownload,
    LucideFile,
    LucideImage,
    LucideLink,
    LucideMessageSquare,
    LucideTrash,
    LucideX
  ],
  templateUrl: './item-drawer.component.html',
  styleUrl: './item-drawer.component.css'
})
export class ItemDrawerComponent implements OnDestroy {
  protected readonly controller = inject(RunnerController);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly item = input.required<ChecklistItemTemplate>();
  readonly answer = input<ItemAnswer | undefined>();
  readonly readonly = input<boolean>(false);

  private readonly noteField = viewChild<ElementRef<HTMLTextAreaElement>>('note');
  private readonly linkField = viewChild<ElementRef<HTMLInputElement>>('link');

  protected readonly mode = this.controller.drawerMode;
  protected readonly evidences = this.controller.drawerEvidences;
  protected readonly kind = computed(() => this.item().evidenceRequired);
  protected readonly isBlocking = computed(() => criticalityOf(this.item()) === 'blocking');
  protected readonly isNa = computed(() => this.answer()?.status === 'NA');
  protected readonly isKo = computed(() => this.answer()?.status === 'KO');
  protected readonly noteRequired = computed(() => this.isKo() && !this.answer()?.comment?.trim());
  protected readonly promptHint = computed(() => {
    const kind = this.kind();
    return this.item().evidenceHint?.trim() || (kind ? KIND_HINTS[kind] : '');
  });

  protected readonly link = computed(() => this.answer()?.evidenceLink ?? '');
  protected readonly linkIsSafe = computed(() => isSafeHttpUrl(this.link()));
  protected readonly linkDraft = signal('');
  protected readonly linkDraftInvalid = computed(() => this.linkDraft().trim() !== '' && !isSafeHttpUrl(this.linkDraft()));
  protected readonly promptSatisfied = computed(() =>
    this.controller.isPromptSatisfied(this.item().id, this.kind() === 'link' ? this.linkDraft() : undefined)
  );
  protected readonly dragOver = signal(false);

  // Valeur de la note à l'entrée dans le champ : Échap la rétablit.
  private noteAtFocus = '';
  // URL blob créées pour l'affichage : chacune réserve de la mémoire tant qu'elle n'est pas révoquée.
  private readonly urlCache = new Map<string, string>();

  constructor() {
    // À l'ouverture et à chaque changement de mode, le focus entre dans le tiroir ;
    // après une mise en KO, il va directement dans la note, obligatoire pour un KO.
    let lastMode: DrawerMode | null = null;
    effect(() => {
      const mode = this.mode();
      const request = this.controller.noteFocusRequest();
      untracked(() => {
        if (request === this.item().id) {
          this.controller.noteFocusRequest.set(null);
          lastMode = mode;
          this.afterRender(() => this.noteField()?.nativeElement.focus());
          return;
        }
        if (mode === lastMode) return;
        lastMode = mode;
        this.linkDraft.set(this.answer()?.evidenceLink ?? '');
        this.afterRender(() => this.focusEntry(mode));
      });
    });
  }

  ngOnDestroy(): void {
    for (const url of this.urlCache.values()) {
      URL.revokeObjectURL(url);
    }
    this.urlCache.clear();
  }

  // --- Note ----------------------------------------------------------------

  onNoteFocus(event: FocusEvent): void {
    this.noteAtFocus = (event.target as HTMLTextAreaElement).value;
  }

  onNoteInput(event: Event): void {
    this.controller.updateNote(this.item().id, (event.target as HTMLTextAreaElement).value);
  }

  /** Entrée : termine la saisie ; Maj+Entrée : saut de ligne ; Échap : rétablit la note d'origine. */
  onNoteKeydown(event: KeyboardEvent): void {
    const field = event.target as HTMLTextAreaElement;
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (this.mode() === 'prompt' && this.promptSatisfied()) {
        void this.controller.validatePrompt();
      } else {
        void this.controller.noteCommitted(this.item().id);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      field.value = this.noteAtFocus;
      this.controller.updateNote(this.item().id, this.noteAtFocus);
      this.controller.focusRow(this.item().id);
    }
  }

  // --- Lien ----------------------------------------------------------------

  onLinkInput(event: Event): void {
    this.linkDraft.set((event.target as HTMLInputElement).value);
  }

  onLinkKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.validate();
    }
  }

  validate(): void {
    void this.controller.validatePrompt(this.kind() === 'link' ? this.linkDraft() : undefined);
  }

  // --- Preuves -------------------------------------------------------------

  getBlobUrl(evidence: EvidenceRecord): string {
    let url = this.urlCache.get(evidence.id);
    if (!url) {
      url = URL.createObjectURL(evidence.blob);
      this.urlCache.set(evidence.id, url);
    }
    return url;
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
  }

  /** Une image collée devient une preuve ; un texte collé dans la note reste du texte. */
  onPaste(event: ClipboardEvent): void {
    if (this.readonly()) return;
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const entry = items[i];
      if (!entry.type.startsWith('image/')) continue;
      const file = entry.getAsFile();
      if (!file) continue;
      event.preventDefault();
      const name = `capture_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
      void this.controller.addFiles(this.item().id, [new File([file], name, { type: file.type })]);
      return;
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.readonly()) this.dragOver.set(true);
  }

  onDragLeave(): void {
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    if (this.readonly()) return;
    const files = event.dataTransfer?.files;
    if (files?.length) void this.controller.addFiles(this.item().id, Array.from(files));
  }

  onFileInput(event: Event): void {
    const field = event.target as HTMLInputElement;
    if (field.files?.length) {
      void this.controller.addFiles(this.item().id, Array.from(field.files));
    }
    field.value = '';
  }

  // --- Focus ---------------------------------------------------------------

  private focusEntry(mode: DrawerMode): void {
    if (mode === 'prompt' && this.kind() === 'comment') {
      this.noteField()?.nativeElement.focus();
    } else if (mode === 'prompt' && this.kind() === 'link') {
      this.linkField()?.nativeElement.focus();
    } else {
      this.host.nativeElement.querySelector<HTMLElement>('.item-drawer')?.focus();
    }
  }

  private afterRender(callback: () => void): void {
    afterNextRender({ read: callback }, { injector: this.injector });
  }
}
