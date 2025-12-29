import { useMemo } from 'react';
import { parseAmount } from '../utils/expenseUtils';

export const useExpenseCalculations = (expenses, parties) => {
  const partyTotals = useMemo(() => {
    const totals = {};
    parties.forEach((party) => {
      totals[party] = { direct: 0, split: 0, total: 0 };
    });

    expenses.forEach((expense) => {
      const cost = parseAmount(expense.cost);
      const paidBy = expense.paidBy;
      if (!paidBy || cost <= 0) return;

      if (paidBy === 'Split Equally') {
        const perPerson = cost / parties.length;
        parties.forEach((party) => {
          totals[party].split += perPerson;
        });
        return;
      }

      if (paidBy === 'Split Between') {
        const selected = Array.isArray(expense.splitParties) && expense.splitParties.length > 0 
          ? expense.splitParties 
          : parties;
        const perPerson = cost / selected.length;
        selected.forEach((party) => {
          if (totals[party]) {
            totals[party].split += perPerson;
          }
        });
        return;
      }

      if (totals[paidBy]) {
        totals[paidBy].direct += cost;
      }
    });

    Object.keys(totals).forEach((party) => {
      totals[party].total = totals[party].direct + totals[party].split;
    });

    return totals;
  }, [expenses, parties]);

  const typeBreakdown = useMemo(() => {
    const breakdown = {};
    expenses.forEach((exp) => {
      const cost = parseAmount(exp.cost);
      if (cost > 0) {
        const type = exp.type || 'Other';
        breakdown[type] = (breakdown[type] || 0) + cost;
      }
    });
    return Object.entries(breakdown)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, exp) => sum + parseAmount(exp.cost), 0);
  }, [expenses]);

  return { partyTotals, typeBreakdown, totalExpenses };
};
