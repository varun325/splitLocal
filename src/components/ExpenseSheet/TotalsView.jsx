import { memo } from 'react';
import { Box, Typography } from '@mui/material';

const formatINR = (amount) => {
  const value = Number(amount) || 0;
  return value.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
};

export const TotalsView = memo(function TotalsView({ parties, partyTotals, totalExpenses }) {
  return (
    <Box>
      <div className="total-expenses-card">
        <div className="total-expenses-content">
          <div className="total-expenses-label">Total Expenses</div>
          <div className="total-expenses-amount">{formatINR(totalExpenses)}</div>
        </div>
      </div>

      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: 'text.secondary' }}>
        Party Totals
      </Typography>
      <div className="balance-list">
        {parties.map(party => {
          const totals = partyTotals[party] || { direct: 0, split: 0, total: 0 };
          return (
            <div key={party} className="balance-item">
              <div className="party-name">{party}</div>
              <div className="balance-details">
                <div className="balance-row">
                  <span>Direct:</span>
                  <span className="amount">{formatINR(totals.direct)}</span>
                </div>
                <div className="balance-row">
                  <span>Split:</span>
                  <span className="amount">{formatINR(totals.split)}</span>
                </div>
                <div className="balance-row net">
                  <span>Total:</span>
                  <span className="amount">{formatINR(totals.total)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Box>
  );
});
