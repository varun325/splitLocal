import { memo, useState, useCallback, useMemo } from 'react';
import { Box, FormControl, InputLabel, Select, MenuItem, Typography } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CHART_SWATCHES } from '../../constants/expenseSheet';
import {
  buildColorMap,
  calculatePartyPercentages,
  calculatePartyTypeBreakdown,
  formatINR,
} from '../../utils/expenseUtils';

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
    () => buildColorMap(typeBreakdown.map((t) => t.name), CHART_SWATCHES, 2),
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
          colors={typeBreakdown.map((entry) => typeColorMap[entry.name] || CHART_SWATCHES[0])}
        />
      )}

      {chartView === 'party-percentage' && (
        <ChartSection
          title="Party Split Percentage"
          data={partyPercentages}
          colors={parties.map((_, idx) => CHART_SWATCHES[idx % CHART_SWATCHES.length])}
          showPercentage
        />
      )}

      {chartView === 'party-breakdown' && selectedParty && (
        <ChartSection
          title={`${selectedParty} - Expense by Type`}
          data={partyBreakdownData}
          colors={partyBreakdownData.map((entry) => typeColorMap[entry.name] || CHART_SWATCHES[0])}
        />
      )}
    </Box>
  );
});
