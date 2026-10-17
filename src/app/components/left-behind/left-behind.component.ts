import { Component, input, output } from '@angular/core';
import { LucideFlag } from '@lucide/angular';

/** Contrôle non bloquant oublié dans une étape franchie (`leftBehind`, ADR 0007). */
export interface LeftBehindEntry {
  itemId: string;
  label: string;
  sectionTitle: string;
  reason: 'sans réponse' | 'preuve à compléter';
}

/**
 * Bloc « Laissés en route » du résumé de la checklist : les contrôles non bloquants restés
 * derrière une porte franchie, cliquables pour y revenir. Masqué quand la liste est vide.
 */
@Component({
  selector: 'app-left-behind',
  standalone: true,
  imports: [LucideFlag],
  templateUrl: './left-behind.component.html',
  styleUrl: './left-behind.component.css'
})
export class LeftBehindComponent {
  readonly entries = input<LeftBehindEntry[]>([]);
  readonly select = output<string>();
}
