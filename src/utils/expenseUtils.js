import { CHART_SWATCHES, EXPENSE_SWATCHES } from '../constants/expenseSheet';

export const parseAmount = (value) => {
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
};

export const formatINR = (amount) => {
  const value = Number(amount) || 0;
  return value.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  });
};

export const hashString = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

export const buildColorMap = (names, swatches = EXPENSE_SWATCHES, startIndex = 0) => {
  const unique = Array.from(new Set(names.filter(Boolean)));
  if (unique.length === 0) return {};

  const map = {};
  unique.forEach((name, index) => {
    map[name] = swatches[(startIndex + index) % swatches.length];
  });
  return map;
};

export const buildHashedColorMap = (names, swatches = EXPENSE_SWATCHES, seed) => {
  const unique = Array.from(new Set(names.filter(Boolean)));
  if (unique.length === 0) return {};
  const start = hashString(seed || unique.join('|')) % swatches.length;
  return buildColorMap(unique, swatches, start);
};

export const uniqueInsensitive = (items) => {
  const seen = new Set();
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
};

export const calculatePartyTypeBreakdown = (expenses, parties, party) => {
  const breakdown = {};

  expenses.forEach((exp) => {
    const cost = parseAmount(exp.cost);
    if (cost <= 0) return;
    const type = exp.type || 'Other';
    const paidBy = exp.paidBy;
    if (!paidBy) return;

    if (paidBy === 'Split Equally') {
      const perPerson = cost / parties.length;
      breakdown[type] = (breakdown[type] || 0) + perPerson;
      return;
    }

    if (paidBy === 'Split Between') {
      const selected = Array.isArray(exp.splitParties) && exp.splitParties.length > 0
        ? exp.splitParties
        : parties;
      if (selected.includes(party)) {
        const perPerson = cost / selected.length;
        breakdown[type] = (breakdown[type] || 0) + perPerson;
      }
      return;
    }

    if (paidBy === party) {
      breakdown[type] = (breakdown[type] || 0) + cost;
    }
  });

  return Object.entries(breakdown)
    .map(([name, value]) => ({ name, value }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
};

export const calculatePartyPercentages = (parties, partyTotals) => {
  const total = Object.values(partyTotals).reduce((sum, t) => sum + (t.total || 0), 0) || 1;
  return parties.map((party) => {
    const value = partyTotals[party]?.total || 0;
    const percentage = Math.round((value / total) * 1000) / 10;
    return { name: party, value, percentage };
  });
};

export const getChartSwatches = () => CHART_SWATCHES;
