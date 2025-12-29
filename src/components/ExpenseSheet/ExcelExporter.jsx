import { memo } from 'react';
import * as XLSX from 'xlsx';

const formatINR = (amount) => {
  const value = Number(amount) || 0;
  return value.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
};

export const generateExcel = (sheetName, expenses, parties, partyTotals, typeBreakdown, totalExpenses) => {
  const wb = XLSX.utils.book_new();

  // Expenses sheet
  const expensesData = expenses.map((exp) => ({
    Description: exp.description || '',
    Cost: Number(exp.cost) || 0,
    Type: exp.type || '',
    'Paid By': exp.paidBy || '',
    'Split Parties': Array.isArray(exp.splitParties) ? exp.splitParties.join(', ') : '',
  }));

  const expensesWS = XLSX.utils.json_to_sheet(expensesData);
  XLSX.utils.book_append_sheet(wb, expensesWS, 'Expenses');

  // Party breakdown sheet
  const partyData = parties.map((party) => {
    const totals = partyTotals[party] || { direct: 0, split: 0, total: 0 };
    return {
      Party: party,
      'Direct Expenses': totals.direct,
      'Split Expenses': totals.split,
      'Total': totals.total,
    };
  });

  const partyWS = XLSX.utils.json_to_sheet(partyData);
  XLSX.utils.book_append_sheet(wb, partyWS, 'Party Breakdown');

  // Type breakdown sheet
  const typeData = typeBreakdown.map((item) => ({
    Type: item.name,
    Amount: item.value,
  }));

  const typeWS = XLSX.utils.json_to_sheet(typeData);
  XLSX.utils.book_append_sheet(wb, typeWS, 'Type Breakdown');

  // Summary sheet
  const summaryData = [
    { Label: 'Sheet Name', Value: sheetName || 'Untitled' },
    { Label: 'Total Expenses', Value: totalExpenses },
    { Label: 'Number of Expenses', Value: expenses.length },
    { Label: 'Number of Parties', Value: parties.length },
    { Label: 'Generated', Value: new Date().toLocaleString('en-IN') },
  ];

  const summaryWS = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summaryWS, 'Summary');

  // Export
  XLSX.writeFile(wb, `${sheetName || 'expense-sheet'}.xlsx`);
};

export const ExcelExporter = memo(function ExcelExporter({ children, ...props }) {
  return children({ generateExcel, ...props });
});
