import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const SWATCHES = [
  '#b91c1c',
  '#db2777',
  '#7e22ce',
  '#6b21a8',
  '#4338ca',
  '#1d4ed8',
  '#0369a1',
  '#0ea5e9',
  '#0f766e',
  '#15803d',
  '#10b981',
  '#65a30d',
  '#a16207',
  '#ca8a04',
  '#c2410c',
  '#9a3412',
  '#92400e',
];

const parseAmount = (value) => {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/,/g, '').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const formatINRNumber = (amount) => {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

const formatINRForPdf = (amount) => `INR ${formatINRNumber(amount)}`;

const hashString = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const buildTypeColorMap = (typeNames) => {
  const names = Array.from(new Set(typeNames.filter(Boolean)));
  if (names.length === 0) return {};
  const start = hashString(names.join('|')) % SWATCHES.length;
  const map = {};
  names.forEach((name, index) => {
    map[name] = SWATCHES[(start + index) % SWATCHES.length];
  });
  return map;
};

const drawPieToCanvas = ({ slices, colors, size = 520 }) => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const cx = size / 2;
  const cy = size / 2;
  const radius = Math.floor(size * 0.36);

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  const total = slices.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
  if (total <= 0) {
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    return canvas;
  }

  let startAngle = -Math.PI / 2;
  slices.forEach((s, idx) => {
    const value = Number(s.value) || 0;
    if (value <= 0) return;
    const angle = (value / total) * Math.PI * 2;
    const endAngle = startAngle + angle;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = colors[idx % colors.length];
    ctx.fill();

    startAngle = endAngle;
  });

  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx, cy, Math.floor(radius * 0.55), 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  ctx.fillStyle = '#111111';
  ctx.font = '700 28px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Total', cx, cy - 16);
  ctx.font = '700 26px Arial';
  ctx.fillText(formatINRForPdf(total), cx, cy + 18);

  return canvas;
};

const illustrationPath = '/images/Innovation-bro.svg';

export const generatePDF = async (sheetName, expenses, parties, partyTotals, typeBreakdown, totalExpenses) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  const nowStr = new Date().toLocaleString();
  const typeColorMap = buildTypeColorMap(typeBreakdown.map((t) => t.name));

  const ensureSpace = (neededHeight, cursorY) => {
    if (cursorY + neededHeight > pageHeight - margin) {
      doc.addPage();
      return margin;
    }
    return cursorY;
  };

  let headerIllustration = null;
  try {
    const response = await fetch(illustrationPath);
    const svgText = await response.text();
    const img = new Image();
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
      img.src = `data:image/svg+xml;base64,${btoa(svgText)}`;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0, 300, 300);
      headerIllustration = canvas.toDataURL('image/png');
    }
  } catch {
    headerIllustration = null;
  }

  doc.setFillColor(246, 240, 215);
  doc.rect(0, 0, pageWidth, 110, 'F');

  if (headerIllustration) {
    const hasGState = typeof doc.GState === 'function';
    if (hasGState) doc.setGState(new doc.GState({ opacity: 0.25 }));
    doc.addImage(headerIllustration, 'PNG', pageWidth - 150, 10, 120, 120);
    if (hasGState) doc.setGState(new doc.GState({ opacity: 1 }));
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('Expense Report', margin, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text(`${sheetName || 'Untitled Sheet'}`, margin, 64);
  doc.setFontSize(9);
  doc.text(`Generated: ${nowStr}`, margin, 84);

  let cursorY = 134;
  doc.setTextColor(15, 23, 42);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(1);

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, cursorY, contentWidth, 80, 8, 8, 'FD');

  doc.setFillColor(137, 152, 109);
  doc.roundedRect(margin, cursorY, 6, 80, 3, 3, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL EXPENSES', margin + 20, cursorY + 28);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(15, 23, 42);
  doc.text(formatINRForPdf(totalExpenses), margin + 20, cursorY + 56);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`${parties.length} parties • ${expenses.length} expenses`, margin + contentWidth - 20, cursorY + 44, { align: 'right' });

  cursorY += 100;

  const partyRows = parties
    .map((party) => {
      const t = partyTotals[party] || { direct: 0, split: 0, total: 0 };
      return { party, direct: t.direct, split: t.split, total: t.total };
    })
    .sort((a, b) => b.total - a.total);

  const partyCol0 = Math.floor(contentWidth * 0.46);
  const partyNum = Math.floor((contentWidth - partyCol0) / 3);
  const partyLast = contentWidth - partyCol0 - partyNum * 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('Party Breakdown', margin, cursorY);
  cursorY += 8;

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    head: [['Party', 'Direct', 'Split', 'Total']],
    body: partyRows.map((r) => [r.party, formatINRForPdf(r.direct), formatINRForPdf(r.split), formatINRForPdf(r.total)]),
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: 8,
      lineColor: [226, 232, 240],
      lineWidth: 1,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 10,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: partyCol0, fontStyle: 'bold' },
      1: { cellWidth: partyNum, halign: 'right' },
      2: { cellWidth: partyNum, halign: 'right' },
      3: { cellWidth: partyLast, halign: 'right', fontStyle: 'bold' },
    },
  });

  cursorY = (doc.lastAutoTable?.finalY || cursorY) + 18;

  doc.addPage();
  cursorY = margin;

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Visual Analytics', margin, cursorY);
  cursorY += 16;

  const makeSlices = (rawItems, colorPicker) => {
    const items = rawItems
      .slice()
      .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
      .map((it, idx) => ({
        label: String(it.label),
        value: Number(it.value) || 0,
        color: colorPicker(it, idx),
      }))
      .filter((it) => it.value > 0);

    const max = 10;
    if (items.length <= max) return items;
    const top = items.slice(0, max);
    const rest = items.slice(max);
    const others = rest.reduce((sum, it) => sum + it.value, 0);
    top.push({ label: 'Others', value: others, color: '#888888' });
    return top;
  };

  const buildLegendRows = (items) => {
    const total = items.reduce((sum, it) => sum + (Number(it.value) || 0), 0) || 1;
    return items.map((it) => {
      const pct = Math.round((it.value / total) * 1000) / 10;
      return [it.color, it.label, formatINRForPdf(it.value), `${pct}%`];
    });
  };

  const computePartyTypeBreakdowns = () => {
    const map = {};
    parties.forEach((p) => {
      map[p] = {};
    });

    expenses.forEach((exp) => {
      const cost = parseAmount(exp.cost);
      if (cost <= 0) return;
      const type = exp.type || 'Other';
      const paidBy = exp.paidBy;
      if (!paidBy) return;

      if (paidBy === 'Split Equally') {
        const per = cost / Math.max(parties.length, 1);
        parties.forEach((p) => {
          map[p][type] = (map[p][type] || 0) + per;
        });
        return;
      }

      if (paidBy === 'Split Between') {
        const selected = Array.isArray(exp.splitParties) && exp.splitParties.length > 0 ? exp.splitParties : parties;
        const per = cost / Math.max(selected.length, 1);
        selected.forEach((p) => {
          if (!map[p]) map[p] = {};
          map[p][type] = (map[p][type] || 0) + per;
        });
        return;
      }

      if (map[paidBy]) {
        map[paidBy][type] = (map[paidBy][type] || 0) + cost;
      }
    });

    return map;
  };

  const drawChartBlock = (title, slices) => {
    cursorY = ensureSpace(340, cursorY);

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, cursorY, contentWidth, 36, 6, 6, 'F');
    doc.setFillColor(137, 152, 109);
    doc.roundedRect(margin, cursorY, 4, 36, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin + 16, cursorY + 23);

    cursorY += 46;

    const chartSize = 420;
    const pieCanvas = drawPieToCanvas({
      slices,
      colors: slices.map((s) => s.color),
      size: chartSize,
    });

    const imgW = 180;
    const imgH = 180;
    const imgX = margin + (contentWidth - imgW) / 2;
    const imgY = cursorY;

    if (pieCanvas) {
      const img = pieCanvas.toDataURL('image/png');
      doc.addImage(img, 'PNG', imgX, imgY, imgW, imgH);
    }

    const legendStartY = imgY + imgH + 16;
    const legendRows = buildLegendRows(slices);

    const colorW = 20;
    const shareW = 70;
    const amountW = 140;
    const categoryW = contentWidth - colorW - amountW - shareW;
    autoTable(doc, {
      startY: legendStartY,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      head: [['', 'Category', 'Amount', 'Share']],
      body: legendRows,
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 7,
        lineColor: [226, 232, 240],
        lineWidth: 1,
        textColor: [15, 23, 42],
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: colorW },
        1: { cellWidth: categoryW, fontStyle: 'bold' },
        2: { cellWidth: amountW, halign: 'right' },
        3: { cellWidth: shareW, halign: 'right', textColor: [100, 116, 139] },
      },
      didDrawCell: (data) => {
        if (data.section !== 'body') return;
        if (data.column.index !== 0) return;
        const color = data.cell.raw;
        if (typeof color !== 'string') return;
        const hex = color.startsWith('#') ? color : null;
        if (hex && hex.length === 7) {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          doc.setFillColor(r, g, b);
        } else {
          doc.setFillColor(156, 171, 132);
        }
        const pad = 5;
        doc.roundedRect(data.cell.x + pad, data.cell.y + pad, data.cell.width - pad * 2, data.cell.height - pad * 2, 2, 2, 'F');
      },
    });

    cursorY = (doc.lastAutoTable?.finalY || legendStartY) + 24;
  };

  const typeSlices = makeSlices(
    typeBreakdown.map((t) => ({ label: t.name, value: t.value })),
    (it) => typeColorMap[it.label] || SWATCHES[0],
  );
  const partySlices = makeSlices(
    partyRows.map((r, idx) => ({ label: r.party, value: r.total, idx })),
    (it) => SWATCHES[(it.idx ?? 0) % SWATCHES.length],
  );

  drawChartBlock('By Type', typeSlices);
  drawChartBlock('By Party', partySlices);

  const partyType = computePartyTypeBreakdowns();
  parties.forEach((party) => {
    const typeMap = partyType[party] || {};
    const slices = makeSlices(
      Object.entries(typeMap).map(([label, value]) => ({ label, value })),
      (it) => typeColorMap[it.label] || SWATCHES[0],
    );
    drawChartBlock(`${party} — By Type`, slices);
  });

  doc.addPage();

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, margin, contentWidth, 36, 6, 6, 'F');
  doc.setFillColor(137, 152, 109);
  doc.roundedRect(margin, margin, 4, 36, 2, 2, 'F');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Detailed Expenses', margin + 16, margin + 23);

  const expenseRows = expenses.map((exp, idx) => {
    const splitPartiesStr = exp.paidBy === 'Split Between' ? (Array.isArray(exp.splitParties) ? exp.splitParties.join(', ') : '') : '';
    const name = exp.name || exp.description || '-';
    return [
      String(idx + 1),
      name,
      exp.type || '-',
      formatINRForPdf(parseAmount(exp.cost)),
      exp.paidBy || '-',
      splitPartiesStr,
    ];
  });

  const expNumW = 28;
  const expCostW = 90;
  const expTypeW = 85;
  const expPaidW = 90;
  const expSplitW = 120;
  const expNameW = contentWidth - expNumW - expTypeW - expCostW - expPaidW - expSplitW;
  autoTable(doc, {
    startY: margin + 46,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    head: [['#', 'Expense', 'Type', 'Cost', 'Paid By', 'Split Parties']],
    body: expenseRows,
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 7,
      lineColor: [226, 232, 240],
      lineWidth: 1,
      overflow: 'linebreak',
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: expNumW, halign: 'right', textColor: [100, 116, 139] },
      1: { cellWidth: expNameW, fontStyle: 'bold' },
      2: { cellWidth: expTypeW },
      3: { cellWidth: expCostW, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: expPaidW },
      5: { cellWidth: expSplitW, fontSize: 8, textColor: [100, 116, 139] },
    },
  });

  const fileSafe = (sheetName || 'sheet').replace(/[^a-z0-9\-_ ]/gi, '').trim() || 'sheet';
  doc.save(`${fileSafe}-report.pdf`);
};

export default generatePDF;
