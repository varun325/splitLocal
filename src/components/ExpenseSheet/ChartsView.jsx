import { memo, useState, useCallback, useMemo } from 'react';
import { Box, FormControl, InputLabel, Select, MenuItem, Typography } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const SWATCHES = [
  '#2196F3', '#F44336', '#4CAF50', '#FF9800', '#9C27B0',
  '#00BCD4', '#FFC107', '#E91E63', '#3F51B5', '#8BC34A',
  '#FF5722', '#009688', '#673AB7', '#CDDC39', '#795548',
];

const formatINR = (amount) => {
  const value = Number(amount) || 0;
  return value.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
};

const parseAmount = (value) => {
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
};

const buildTypeColorMap = (typeNames) => {
  const map = {};
  const start = 2;
  typeNames.forEach((name, index) => {
    map[name] = SWATCHES[(start + index) % SWATCHES.length];
  });
  return map;
};

const calculatePartyTypeBreakdown = (expenses, parties, party) => {
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
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value);
};

const calculatePartyPercentages = (parties, partyTotals) => {
  const total = Object.values(partyTotals).reduce((sum, t) => sum + (t.total || 0), 0) || 1;
  return parties.map(party => {
    const value = partyTotals[party]?.total || 0;
    const percentage = Math.round((value / total) * 1000) / 10;
    return { name: party, value, percentage };
  });
};

const ChartSection = memo(function ChartSection({ 
  title, 
  data, 
  colors, 
  showPercentage = false 
}) {
  if (!data || data.length === 0) {
    return (
      <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>
        No data available
      </Typography>
    );
  }

  return (
    <>
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: 'text.secondary' }}>
        {title}
      </Typography>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => formatINR(value)} />
        </PieChart>
      </ResponsiveContainer>

      <div className="chart-legend">
        {data.sort((a, b) => b.value - a.value).map((item, index) => (
          <div key={item.name} className="legend-item">
            <span
              className="legend-swatch"
              style={{ backgroundColor: colors[index % colors.length] }}
            />
            <span className="legend-name">{item.name}</span>
            <span className="legend-value">
              {showPercentage ? `${item.percentage}% • ` : ''}{formatINR(item.value)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
});

export const ChartsView = memo(function ChartsView({ 
  expenses, 
  parties, 
  typeBreakdown, 
  partyTotals, 
  totalExpenses 
}) {
  const [chartView, setChartView] = useState('type');
  const [selectedParty, setSelectedParty] = useState(parties[0] || '');

  const typeColorMap = useMemo(
    () => buildTypeColorMap(typeBreakdown.map((t) => t.name)),
    [typeBreakdown]
  );

  const partyPercentages = useMemo(
    () => calculatePartyPercentages(parties, partyTotals),
    [parties, partyTotals]
  );

  const partyBreakdownData = useMemo(() => {
    if (!selectedParty) return [];
    return calculatePartyTypeBreakdown(expenses, parties, selectedParty);
  }, [expenses, parties, selectedParty]);

  const partyBreakdownTotal = useMemo(() => {
    return partyBreakdownData.reduce((sum, item) => sum + item.value, 0);
  }, [partyBreakdownData]);

  const handleChartViewChange = useCallback((e) => {
    const value = e.target.value;
    setChartView(value);
    if (value === 'party-breakdown' && parties.length > 0 && !selectedParty) {
      setSelectedParty(parties[0]);
    }
  }, [parties, selectedParty]);

  const totalToShow = chartView === 'party-breakdown' && selectedParty
    ? partyBreakdownTotal
    : totalExpenses;

  const totalLabel = chartView === 'party-breakdown' && selectedParty
    ? `${selectedParty} Total`
    : 'Total Expenses';

  return (
    <Box>
      <div className="chart-total-display">
        <div className="chart-total-label">{totalLabel}</div>
        <div className="chart-total-amount">{formatINR(totalToShow)}</div>
      </div>

      <Box sx={{ mb: 2 }}>
        <FormControl fullWidth size="small">
          <InputLabel>View</InputLabel>
          <Select value={chartView} label="View" onChange={handleChartViewChange}>
            <MenuItem value="type">By Type (Total)</MenuItem>
            <MenuItem value="party-percentage">By Party (%)</MenuItem>
            <MenuItem value="party-breakdown">By Party Type Breakdown</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {chartView === 'party-breakdown' && (
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Select Party</InputLabel>
          <Select
            value={selectedParty}
            label="Select Party"
            onChange={(e) => setSelectedParty(e.target.value)}
          >
            {parties.map(party => (
              <MenuItem key={party} value={party}>{party}</MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {chartView === 'type' && (
        <ChartSection
          title="Expense by Type"
          data={typeBreakdown}
          colors={typeBreakdown.map(entry => typeColorMap[entry.name] || SWATCHES[0])}
        />
      )}

      {chartView === 'party-percentage' && (
        <ChartSection
          title="Party Split Percentage"
          data={partyPercentages}
          colors={parties.map((_, idx) => SWATCHES[idx % SWATCHES.length])}
          showPercentage
        />
      )}

      {chartView === 'party-breakdown' && selectedParty && (
        <ChartSection
          title={`${selectedParty} - Expense by Type`}
          data={partyBreakdownData}
          colors={partyBreakdownData.map(entry => typeColorMap[entry.name] || SWATCHES[0])}
        />
      )}
    </Box>
  );
});
