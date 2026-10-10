import { Injectable, inject } from '@angular/core';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ChecklistSessionService } from './checklist-session.service';
import { TemplateService } from './template.service';

@Injectable({
  providedIn: 'root'
})
export class ExportService {
  private sessionService = inject(ChecklistSessionService);
  private templateService = inject(TemplateService);

  exportJson(): void {
    const session = this.sessionService.currentSession();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(session, null, 2));
    const version = session.contextValues['version'] || 'brouillon';
    const date = session.contextValues['date'] || new Date().toISOString().split('T')[0];
    const filename = `audit_livraison_${version}_${date}.json`;

    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  exportExcel(): void {
    const session = this.sessionService.currentSession();
    const metrics = this.sessionService.metrics();
    const applicableItems = this.sessionService.applicableItems();

    const rows: (string | number)[][] = [];

    // Header & Métadonnées
    rows.push(['RAPPORT DE CONTRÔLE PERMANENT DE LIVRAISON', '', '', '']);
    rows.push(['Version :', session.contextValues['version'] || 'N/A', 'Date :', session.contextValues['date'] || 'N/A']);
    rows.push([
      'Type de livraison :',
      session.contextValues['mode'] === 'patch' ? 'Patch' : 'Livraison complète',
      'Responsable :',
      session.contextValues['responsible'] || 'N/A'
    ]);
    rows.push([
      'Taux de complétude :',
      `${metrics.percent}%`,
      'Synthèse :',
      `${metrics.okCount} OK, ${metrics.koCount} KO, ${metrics.naCount} N/A`
    ]);
    rows.push([]);

    // En-tête du tableau
    rows.push(['Catégorie', "Contrôle / Règle d'audit", 'Statut', 'Commentaire / Justification / Observations']);

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

      rows.push([
        item.sectionTitle,
        item.label,
        ans.status || 'À TRAITER',
        commentText
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 28 }, // Catégorie
      { wch: 55 }, // Contrôle
      { wch: 14 }, // Statut
      { wch: 50 }  // Commentaires
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contrôle Livraison');

    const fileName = `Checklist-${session.contextValues['version'] || 'Release'}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  exportPdf(): void {
    const session = this.sessionService.currentSession();
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
    doc.text("RAPPORT D'AUDIT DE LIVRAISON LOGICIELLE", 14, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text("Contrôle Permanent & Traçabilité de Déploiement", 14, 18);

    // Bloc Métadonnées
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Paramètres de la mise en production :', 14, 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 35, 182, 22, 2, 2, 'F');

    doc.text(`Version : ${session.contextValues['version'] || 'Non spécifiée'}`, 18, 41);
    doc.text(`Type : ${session.contextValues['mode'] === 'patch' ? 'Patch' : 'Livraison complète'}`, 18, 47);
    doc.text(`Responsable : ${session.contextValues['responsible'] || 'Non renseigné'}`, 18, 53);

    doc.text(`Date de contrôle : ${session.contextValues['date'] || 'N/A'}`, 110, 41);
    doc.text(`Progression : ${metrics.percent}% (${metrics.answered}/${metrics.total})`, 110, 47);
    doc.text(`Synthèse : ${metrics.okCount} OK  |  ${metrics.koCount} KO  |  ${metrics.naCount} N/A`, 110, 53);

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

      tableData.push([
        item.sectionTitle,
        item.label,
        ans.status || 'À TRAITER',
        commentText || '-'
      ]);
    }

    autoTable(doc, {
      startY: 62,
      head: [['Section', 'Point de contrôle', 'Statut', 'Observations / Justification']],
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
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 55 }
      },
      didParseCell: (data) => {
        if (data.column.index === 2 && data.section === 'body') {
          const val = data.cell.raw;
          if (val === 'OK') {
            data.cell.styles.textColor = [16, 149, 106];
            data.cell.styles.fontStyle = 'bold';
          } else if (val === 'KO') {
            data.cell.styles.textColor = [225, 29, 72];
            data.cell.styles.fontStyle = 'bold';
          } else if (val === 'NA') {
            data.cell.styles.textColor = [100, 116, 139];
          } else {
            data.cell.styles.textColor = [217, 119, 6];
          }
        }
      },
      margin: { top: 15, left: 14, right: 14, bottom: 20 },
      didDrawPage: () => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${pageCount}`, 196, 290, { align: 'right' });
        doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} - Piste d'audit`, 14, 290);
      }
    });

    const fileName = `Audit_Livraison_${session.contextValues['version'] || 'Version'}.pdf`;
    doc.save(fileName);
  }
}
