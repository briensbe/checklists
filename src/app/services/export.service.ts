import { Injectable, inject } from '@angular/core';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ChecklistSessionService } from './checklist-session.service';
import { EvidenceService } from './evidence.service';
import { downloadBlob, toFileBaseName } from './download';
import { EvidenceRecord } from '../models/checklist.model';
import { blobToBase64 } from '../data/base64';
import {
  buildExchangeHeader,
  exchangeFileParts,
  formatBytes,
  toExchangeEvidence,
  toExchangeEvidenceMeta
} from '../domain/session-exchange';
import { ApplicableItem } from '../domain/session-rules';
import {
  itemObservations,
  itemStateText,
  ReportField,
  reportHeaderFields,
  reportSummaryFields
} from '../domain/report';

/** Miniature prête à être insérée dans le PDF. */
interface Thumbnail {
  dataUrl: string;
  width: number;
  height: number;
}

/** Côté maximal (px) des miniatures : assez net à l'impression, sans alourdir le PDF. */
const THUMBNAIL_MAX_PX = 600;

// Mise en page A4 (mm)
const PAGE_BOTTOM = 280;
const MARGIN_X = 14;
const CONTENT_WIDTH = 182;

const EVIDENCE_TYPE_LABELS: Record<EvidenceRecord['type'], string> = {
  image: 'image',
  file: 'fichier',
  log: 'log'
};

@Injectable({
  providedIn: 'root'
})
export class ExportService {
  private sessionService = inject(ChecklistSessionService);
  private evidenceService = inject(EvidenceService);

  // --- Fichier d'échange (JSON ré-importable, ADR 0004) --------------------

  /**
   * Aperçu du fichier d'échange. Les preuves (si incluses) n'y figurent que par leurs
   * métadonnées : afficher plusieurs Mo de base64 dans la fenêtre bloquerait l'interface.
   */
  getExchangePreview(evidences?: EvidenceRecord[]): string {
    const session = this.sessionService.currentSession();
    if (!session) return '{}';
    const header = buildExchangeHeader(session, this.sessionService.metrics());
    const preview = evidences ? { ...header, evidences: evidences.map(toExchangeEvidenceMeta) } : header;
    return JSON.stringify(preview, null, 2);
  }

  getJsonFilename(): string {
    const session = this.sessionService.currentSession();
    if (!session) return 'checklist.json';
    // toLocaleLowerCase('fr') : minuscules qui respectent les accents (« É » → « é »).
    const cleanTitle = toFileBaseName(session.title.toLocaleLowerCase('fr'), 'checklist');
    const date = new Date().toISOString().split('T')[0];
    return `${cleanTitle}_${date}.json`;
  }

  /**
   * Télécharge le fichier d'échange. Avec pièces jointes, chaque preuve est encodée puis
   * sérialisée à part et le fichier est assemblé en `Blob` à partir de ces morceaux.
   */
  async exportSessionFile(includeEvidence: boolean): Promise<void> {
    await this.sessionService.flushPendingSave();
    const session = this.sessionService.currentSession();
    if (!session) return;

    const header = buildExchangeHeader(session, this.sessionService.metrics());
    let evidenceJson: string[] | undefined;
    if (includeEvidence) {
      evidenceJson = [];
      for (const record of await this.evidenceService.getSessionEvidences(session.id)) {
        evidenceJson.push(JSON.stringify(toExchangeEvidence(record, await blobToBase64(record.blob))));
      }
    }

    const blob = new Blob(exchangeFileParts(header, evidenceJson), { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, this.getJsonFilename());
  }

  // --- Excel ---------------------------------------------------------------

  exportExcel(): void {
    const session = this.sessionService.currentSession();
    if (!session) return;

    const rows: (string | number)[][] = [];
    rows.push([session.title.toUpperCase(), '', '', '']);

    // Cartouche : paires « libellé | valeur » sur deux colonnes, nombre de lignes variable.
    const fields = [...reportHeaderFields(session), ...reportSummaryFields(this.sessionService.metrics())];
    for (let i = 0; i < fields.length; i += 2) {
      const left = fields[i];
      const right = fields[i + 1];
      rows.push([`${left.label} :`, left.value, right ? `${right.label} :` : '', right?.value ?? '']);
    }
    rows.push([]);

    rows.push(['Catégorie', 'Tâche / Contrôle', 'État / Statut', 'Commentaire / Observations']);
    for (const item of this.sessionService.applicableItems()) {
      const answer = session.answers[item.id];
      rows.push([item.sectionTitle, item.label, itemStateText(item, answer), itemObservations(item, answer, ' | ')]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 28 }, { wch: 55 }, { wch: 22 }, { wch: 50 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Checklist');
    XLSX.writeFile(wb, `${this.fileBaseName()}.xlsx`);
  }

  // --- PDF -----------------------------------------------------------------

  async exportPdf(): Promise<void> {
    const session = this.sessionService.currentSession();
    if (!session) return;

    const applicableItems = this.sessionService.applicableItems();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // En-tête
    doc.setFillColor(8, 47, 73);
    doc.rect(0, 0, 210, 24, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(session.title.toUpperCase(), MARGIN_X, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text("Rapport d'exécution de checklist", MARGIN_X, 18);

    // Cartouche
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Paramètres & Synthèse :', MARGIN_X, 32);
    const fields = [...reportHeaderFields(session), ...reportSummaryFields(this.sessionService.metrics())];
    const tableStartY = this.drawHeaderFields(doc, fields, 35);

    // Tableau des contrôles
    const tableData = applicableItems.map(item => {
      const answer = session.answers[item.id];
      return [item.sectionTitle, item.label, itemStateText(item, answer), itemObservations(item, answer, '\n') || '-'];
    });

    autoTable(doc, {
      startY: tableStartY,
      head: [['Section', 'Tâche / Contrôle', 'État', 'Observations / Justification']],
      body: tableData,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2.5, valign: 'middle' },
      headStyles: { fillColor: [3, 105, 161], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 70 },
        2: { cellWidth: 26, halign: 'center' },
        3: { cellWidth: 51 }
      },
      margin: { top: 15, left: MARGIN_X, right: MARGIN_X, bottom: 20 }
    });

    const evidences = await this.evidenceService.getSessionEvidences(session.id);
    await this.drawEvidenceAppendix(doc, applicableItems, evidences);
    this.drawFooters(doc);

    doc.save(`${this.fileBaseName()}.pdf`);
  }

  /** Cartouche à deux colonnes dont la hauteur suit le nombre de champs ; renvoie l'ordonnée suivante. */
  private drawHeaderFields(doc: jsPDF, fields: ReportField[], top: number): number {
    const rowHeight = 6;
    const rowCount = Math.ceil(fields.length / 2);
    const boxHeight = rowCount * rowHeight + 4;

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(MARGIN_X, top, CONTENT_WIDTH, boxHeight, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    fields.forEach((field, i) => {
      const x = i % 2 === 0 ? 18 : 110;
      const y = top + 6 + Math.floor(i / 2) * rowHeight;
      // Une ligne par champ : une valeur trop longue est tronquée plutôt que de chevaucher la suivante.
      const line = (doc.splitTextToSize(`${field.label} : ${field.value}`, 86) as string[])[0];
      doc.text(line, x, y);
    });
    return top + boxHeight + 5;
  }

  /** Annexe : preuves groupées par item applicable, images en miniatures, autres fichiers listés. */
  private async drawEvidenceAppendix(doc: jsPDF, items: ApplicableItem[], evidences: EvidenceRecord[]): Promise<void> {
    const byItem = new Map<string, EvidenceRecord[]>();
    for (const evidence of evidences) {
      byItem.set(evidence.itemId, [...(byItem.get(evidence.itemId) ?? []), evidence]);
    }
    const groups = items.filter(item => byItem.has(item.id));
    if (groups.length === 0) return;

    doc.addPage();
    let y = 20;
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Annexe — Preuves', MARGIN_X, y);
    y += 10;

    const ensureSpace = (needed: number): void => {
      if (y + needed > PAGE_BOTTOM) {
        doc.addPage();
        y = 20;
      }
    };

    for (const item of groups) {
      const heading = doc.splitTextToSize(`${item.sectionTitle} — ${item.label}`, CONTENT_WIDTH) as string[];
      ensureSpace(heading.length * 5 + 10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(heading, MARGIN_X, y);
      y += heading.length * 5 + 2;

      const images: { evidence: EvidenceRecord; thumb: Thumbnail }[] = [];
      const others: EvidenceRecord[] = [];
      for (const evidence of byItem.get(item.id) ?? []) {
        const thumb = evidence.type === 'image' ? await this.toThumbnail(evidence.blob) : null;
        if (thumb) images.push({ evidence, thumb });
        else others.push(evidence);
      }

      // Grille de 3 miniatures par ligne, ratio conservé, nom sous chaque image.
      const cellWidth = 56;
      const gap = (CONTENT_WIDTH - 3 * cellWidth) / 2;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      for (let i = 0; i < images.length; i += 3) {
        const row = images.slice(i, i + 3).map(({ evidence, thumb }) => {
          const scale = Math.min(cellWidth / thumb.width, cellWidth / thumb.height);
          return { evidence, thumb, w: thumb.width * scale, h: thumb.height * scale };
        });
        const rowHeight = Math.max(...row.map(cell => cell.h)) + 7;
        ensureSpace(rowHeight);
        row.forEach((cell, col) => {
          const x = MARGIN_X + col * (cellWidth + gap);
          doc.addImage(cell.thumb.dataUrl, 'JPEG', x, y, cell.w, cell.h);
          const name = (doc.splitTextToSize(cell.evidence.name, cellWidth) as string[])[0];
          doc.text(name, x, y + cell.h + 4);
        });
        y += rowHeight;
      }
      if (images.length > 0 && others.length > 0) y += 3;

      doc.setFontSize(8);
      for (const evidence of others) {
        ensureSpace(5);
        // Une image arrivée ici n'a pas pu être décodée : on le signale plutôt que de la taire.
        const typeLabel = evidence.type === 'image' ? 'image illisible' : EVIDENCE_TYPE_LABELS[evidence.type];
        const line = `• ${evidence.name} — ${typeLabel} — ${formatBytes(evidence.size)}`;
        doc.text((doc.splitTextToSize(line, CONTENT_WIDTH) as string[])[0], MARGIN_X + 2, y);
        y += 5;
      }
      y += 4;
    }
  }

  /**
   * Réduit une image sur un canvas et la convertit en JPEG. Avantages : jsPDF ne gère
   * nativement que JPEG/PNG (le canvas convertit aussi WebP, GIF, BMP...) et une capture
   * pleine résolution ne gonfle pas le PDF. `null` si le navigateur ne sait pas la décoder.
   */
  private async toThumbnail(blob: Blob): Promise<Thumbnail | null> {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(blob);
      const scale = Math.min(1, THUMBNAIL_MAX_PX / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      // Le JPEG n'a pas de transparence : sans fond blanc, les zones transparentes d'un PNG deviendraient noires.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      return { dataUrl: canvas.toDataURL('image/jpeg', 0.8), width, height };
    } catch {
      return null;
    } finally {
      bitmap?.close();
    }
  }

  /** Pied de page sur toutes les pages, une fois le document complet (numérotation « n / total »). */
  private drawFooters(doc: jsPDF): void {
    const pageCount = doc.getNumberOfPages();
    const generatedOn = `Document généré le ${new Date().toLocaleDateString('fr-FR')}`;
    for (let page = 1; page <= pageCount; page++) {
      doc.setPage(page);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${page} / ${pageCount}`, 196, 290, { align: 'right' });
      doc.text(generatedOn, MARGIN_X, 290);
    }
  }

  private fileBaseName(): string {
    const session = this.sessionService.currentSession();
    return toFileBaseName(session?.title ?? '', 'Checklist');
  }
}
