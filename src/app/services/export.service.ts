import { Injectable, inject } from '@angular/core';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ChecklistSessionService } from './checklist-session.service';
import { EvidenceService } from './evidence.service';
import { ItemAnswer } from '../models/checklist.model';

type EnrichedAnswer = ItemAnswer & { label?: string; sectionTitle?: string; evidenceCount?: number };

@Injectable({
  providedIn: 'root'
})
export class ExportService {
  private sessionService = inject(ChecklistSessionService);
  private evidenceService = inject(EvidenceService);

  getJsonDraft(): string {
    const session = this.sessionService.currentSession();
    const template = this.sessionService.currentTemplate();
    const metrics = this.sessionService.metrics();
    const applicableItems = this.sessionService.applicableItems();
    const evidenceCounts = this.evidenceService.evidenceCounts();

    if (!session) return '{}';

    const details = applicableItems.map(item => {
      const ans = session.answers[item.id] || { status: null, comment: '', extra: {} };
      return {
        sectionId: item.sectionId,
        sectionTitle: item.sectionTitle,
        itemId: item.id,
        label: item.label,
        help: item.help || '',
        controlType: item.controlType || 'status',
        status: ans.status || null,
        checked: ans.checked || false,
        checkedAt: ans.checkedAt || null,
        selectedChoice: ans.selectedChoice || null,
        comment: ans.comment || '',
        extra: ans.extra || {},
        evidenceCount: evidenceCounts[item.id] || 0
      };
    });

    const enrichedAnswers: Record<string, EnrichedAnswer> = {};
    for (const item of applicableItems) {
      const ans = session.answers[item.id] || { status: null, comment: '', extra: {} };
      enrichedAnswers[item.id] = {
        ...ans,
        label: item.label,
        sectionTitle: item.sectionTitle,
        evidenceCount: evidenceCounts[item.id] || 0
      };
    }

    for (const [key, ans] of Object.entries(session.answers)) {
      if (!enrichedAnswers[key]) {
        enrichedAnswers[key] = ans;
      }
    }

    const exportData = {
      id: session.id,
      title: session.title,
      templateId: session.templateId,
      templateName: template?.name || session.templateId,
      contextValues: session.contextValues,
      metrics: {
        total: metrics.total,
        answered: metrics.answered,
        okCount: metrics.okCount,
        koCount: metrics.koCount,
        naCount: metrics.naCount,
        pending: metrics.pending,
        percent: metrics.percent
      },
      details,
      answers: enrichedAnswers,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    };

    return JSON.stringify(exportData, null, 2);
  }

  getJsonFilename(): string {
    const session = this.sessionService.currentSession();
    if (!session) return 'checklist.json';
    const cleanTitle = (session.title || 'checklist').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const date = new Date().toISOString().split('T')[0];
    return `${cleanTitle}_${date}.json`;
  }

  exportJson(): void {
    const jsonStr = this.getJsonDraft();
    const filename = this.getJsonFilename();
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', url);
    downloadAnchor.setAttribute('download', filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
  }

  exportExcel(): void {
    const session = this.sessionService.currentSession();
    if (!session) return;

    const metrics = this.sessionService.metrics();
    const applicableItems = this.sessionService.applicableItems();

    const rows: (string | number)[][] = [];

    // Header & Métadonnées
    rows.push([session.title.toUpperCase(), '', '', '']);
    rows.push(['Version :', session.contextValues['version'] || 'N/A', 'Date :', session.contextValues['date'] || 'N/A']);
    rows.push([
      'Type de livraison :',
      session.contextValues['mode'] === 'patch' ? 'Patch' : 'Complet',
      'Responsable :',
      session.contextValues['responsible'] || 'N/A'
    ]);
    rows.push([
      'Taux de complétude :',
      `${metrics.percent}%`,
      'Synthèse :',
      `${metrics.answered} / ${metrics.total} complété(s)`
    ]);
    rows.push([]);

    // En-tête du tableau
    rows.push(['Catégorie', 'Tâche / Contrôle', 'État / Statut', 'Commentaire / Observations']);

    // Données des points de contrôle
    for (const item of applicableItems) {
      const ans = session.answers[item.id] || { status: null, comment: '', extra: {} };
      let commentText = ans.comment || '';
      if (ans.extra && Object.keys(ans.extra).length > 0) {
        const extras = Object.entries(ans.extra)
          .map(([k, v]) => `${k}: ${v}`)
          .join(' | ');
        commentText += (commentText ? ' | ' : '') + extras;
      }

      let stateText = 'À TRAITER';
      const type = item.controlType || 'status';
      if (type === 'checkbox') {
        stateText = ans.checked ? (ans.checkedAt ? `FAIT (${ans.checkedAt})` : 'FAIT') : 'NON FAIT';
      } else if (type === 'choice') {
        stateText = ans.selectedChoice || 'NON SÉLECTIONNÉ';
      } else {
        stateText = ans.status || 'À TRAITER';
      }

      rows.push([
        item.sectionTitle,
        item.label,
        stateText,
        commentText
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 28 },
      { wch: 55 },
      { wch: 20 },
      { wch: 50 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Checklist');

    const fileName = `${(session.title || 'Checklist').replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  exportPdf(): void {
    const session = this.sessionService.currentSession();
    if (!session) return;

    const metrics = this.sessionService.metrics();
    const applicableItems = this.sessionService.applicableItems();

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // En-tête Corporate
    doc.setFillColor(8, 47, 73);
    doc.rect(0, 0, 210, 24, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(session.title.toUpperCase(), 14, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text("Rapport d'exécution de checklist", 14, 18);

    // Bloc Métadonnées
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Paramètres & Synthèse :', 14, 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 35, 182, 22, 2, 2, 'F');

    doc.text(`Titre : ${session.title}`, 18, 41);
    doc.text(`Version : ${session.contextValues['version'] || 'N/A'}`, 18, 47);
    doc.text(`Responsable : ${session.contextValues['responsible'] || 'Non renseigné'}`, 18, 53);

    doc.text(`Date : ${session.contextValues['date'] || new Date().toLocaleDateString('fr-FR')}`, 110, 41);
    doc.text(`Progression : ${metrics.percent}% (${metrics.answered}/${metrics.total})`, 110, 47);
    doc.text(`Complétés : ${metrics.okCount}  |  En attente : ${metrics.pending}`, 110, 53);

    // Données pour le tableau
    const tableData: (string | number)[][] = [];
    for (const item of applicableItems) {
      const ans = session.answers[item.id] || { status: null, comment: '', extra: {} };
      let commentText = ans.comment || '';
      if (ans.extra && Object.keys(ans.extra).length > 0) {
        const extras = Object.entries(ans.extra)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n');
        commentText += (commentText ? '\n' : '') + extras;
      }

      let stateText = '-';
      const type = item.controlType || 'status';
      if (type === 'checkbox') {
        stateText = ans.checked ? 'FAIT' : 'NON FAIT';
      } else if (type === 'choice') {
        stateText = ans.selectedChoice || '-';
      } else {
        stateText = ans.status || 'À TRAITER';
      }

      tableData.push([
        item.sectionTitle,
        item.label,
        stateText,
        commentText || '-'
      ]);
    }

    autoTable(doc, {
      startY: 62,
      head: [['Section', 'Tâche / Contrôle', 'État', 'Observations / Justification']],
      body: tableData,
      theme: 'striped',
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        valign: 'middle'
      },
      headStyles: {
        fillColor: [3, 105, 161],
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 70 },
        2: { cellWidth: 26, halign: 'center' },
        3: { cellWidth: 51 }
      },
      margin: { top: 15, left: 14, right: 14, bottom: 20 },
      didDrawPage: () => {
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${pageCount}`, 196, 290, { align: 'right' });
        doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')}`, 14, 290);
      }
    });

    const fileName = `${(session.title || 'Checklist').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    doc.save(fileName);
  }
}
