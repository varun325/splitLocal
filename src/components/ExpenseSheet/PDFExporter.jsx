import { memo } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import illustration from '../assets/Innovation-bro.svg?url';

const formatINR = (amount) => {
  const value = Number(amount) || 0;
  return value.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
};

export const generatePDF = (sheetName, expenses, parties, partyTotals, typeBreakdown, totalExpenses) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Color palette
  const CREAM = '#F6F0D7';
  const LIGHT_GREEN = '#C5D89D';
  const MEDIUM_GREEN = '#9CAB84';
  const OLIVE = '#89986D';

  // Header background
  doc.setFillColor(CREAM);
  doc.rect(0, 0, pageWidth, 50, 'F');

  // Illustration
  const illustrationSize = 120;
  const illustrationX = pageWidth - 150;
  const illustrationY = 10;

  const img = new Image();
  img.src = illustration;

  try {
    doc.addImage(img, 'SVG', illustrationX, illustrationY, illustrationSize, illustrationSize, undefined, 'NONE', 0, 25);
  } catch (err) {
    console.warn('Could not add illustration:', err);
  }

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(60, 60, 60);
  doc.text(sheetName || 'Expense Sheet', 14, 22);

  // Date
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated on ${new Date().toLocaleDateString('en-IN')}`, 14, 30);

  // Total Expenses Badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(80, 80, 80);
  doc.text('Total Expenses:', 14, 42);

  doc.setFillColor(MEDIUM_GREEN);
  const totalText = formatINR(totalExpenses);
  const totalWidth = doc.getTextWidth(totalText) + 8;
  doc.roundedRect(70, 36, totalWidth, 8, 2, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.text(totalText, 74, 42);

  let yPos = 58;

  // Expenses Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(60, 60, 60);
  doc.text('Expenses', 14, yPos);
  yPos += 4;

  const tableData = expenses.map((exp) => [
    exp.description || '',
    formatINR(exp.cost),
    exp.type || '',
    exp.paidBy || '',
  ]);

  doc.autoTable({
    startY: yPos,
    head: [['Description', 'Cost', 'Type', 'Paid By']],
    body: tableData,
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: [60, 60, 60],
    },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [80, 80, 80],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    margin: { left: 14, right: 14 },
  });

  yPos = doc.lastAutoTable.finalY + 10;

  if (yPos > pageHeight - 60) {
    doc.addPage();
    yPos = 20;
  }

  // Party Breakdown
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(60, 60, 60);
  doc.text('Party Breakdown', 14, yPos);
  yPos += 4;

  const partyData = parties.map((party) => {
    const totals = partyTotals[party] || { direct: 0, split: 0, total: 0 };
    return [party, formatINR(totals.direct), formatINR(totals.split), formatINR(totals.total)];
  });

  doc.autoTable({
    startY: yPos,
    head: [['Party', 'Direct', 'Split', 'Total']],
    body: partyData,
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: [60, 60, 60],
    },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [80, 80, 80],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    margin: { left: 14, right: 14 },
  });

  yPos = doc.lastAutoTable.finalY + 10;

  if (yPos > pageHeight - 40) {
    doc.addPage();
    yPos = 20;
  }

  // Type Breakdown
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(60, 60, 60);
  doc.text('Expense by Type', 14, yPos);
  yPos += 4;

  const typeData = typeBreakdown.map((item) => [item.name, formatINR(item.value)]);

  doc.autoTable({
    startY: yPos,
    head: [['Type', 'Amount']],
    body: typeData,
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: [60, 60, 60],
    },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [80, 80, 80],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    margin: { left: 14, right: 14 },
  });

  // Save
  doc.save(`${sheetName || 'expense-sheet'}.pdf`);
};

export const PDFExporter = memo(function PDFExporter({ children, ...props }) {
  return children({ generatePDF, ...props });
});
