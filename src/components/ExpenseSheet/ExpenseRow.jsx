import { memo, useCallback } from 'react';
import { IconButton, TextField, FormControl, InputLabel, Select, MenuItem, Checkbox, ListItemText } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

export const ExpenseRow = memo(function ExpenseRow({
  expense,
  index,
  parties,
  expenseTypes,
  provided,
  onFieldChange,
  onDelete
}) {
  const handleChange = useCallback((field, value) => {
    onFieldChange(index, field, value);
  }, [index, onFieldChange]);

  const handlePaidByChange = useCallback((e) => {
    const value = e.target.value;
    handleChange('paidBy', value);
    if (value !== 'Split Between') {
      handleChange('splitParties', []);
    }
  }, [handleChange]);

  const handleSplitPartiesChange = useCallback((e) => {
    handleChange('splitParties', e.target.value);
  }, [handleChange]);

  return (
    <div
      className="expense-row"
      ref={provided.innerRef}
      {...provided.draggableProps}
      style={provided.draggableProps.style}
    >
      <div className="drag-handle" {...provided.dragHandleProps}>
        <DragIndicatorIcon fontSize="small" sx={{ color: 'text.disabled' }} />
      </div>

      <TextField
        label="Description"
        value={expense.description || ''}
        onChange={(e) => handleChange('description', e.target.value)}
        size="small"
        fullWidth
      />

      <TextField
        label="Cost"
        type="number"
        value={expense.cost || ''}
        onChange={(e) => handleChange('cost', e.target.value)}
        size="small"
        fullWidth
      />

      <FormControl fullWidth size="small">
        <InputLabel>Type</InputLabel>
        <Select
          value={expense.type || ''}
          onChange={(e) => handleChange('type', e.target.value)}
          label="Type"
        >
          {expenseTypes.map((type) => (
            <MenuItem key={type} value={type}>
              {type}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth size="small">
        <InputLabel>Paid By</InputLabel>
        <Select
          value={expense.paidBy || ''}
          onChange={handlePaidByChange}
          label="Paid By"
        >
          <MenuItem value="Split Equally">Split Equally</MenuItem>
          <MenuItem value="Split Between">Split Between</MenuItem>
          {parties.map((party) => (
            <MenuItem key={party} value={party}>
              {party}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {expense.paidBy === 'Split Between' && (
        <FormControl fullWidth size="small">
          <InputLabel>Split Between</InputLabel>
          <Select
            multiple
            value={Array.isArray(expense.splitParties) ? expense.splitParties : []}
            onChange={handleSplitPartiesChange}
            label="Split Between"
            renderValue={(selected) => selected.join(', ')}
          >
            {parties.map((party) => (
              <MenuItem key={party} value={party}>
                <Checkbox checked={Array.isArray(expense.splitParties) && expense.splitParties.includes(party)} />
                <ListItemText primary={party} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      <IconButton
        aria-label="delete"
        onClick={() => onDelete(index)}
        size="small"
        sx={{ color: 'error.main' }}
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return (
    prevProps.expense === nextProps.expense &&
    prevProps.index === nextProps.index &&
    prevProps.parties === nextProps.parties &&
    prevProps.expenseTypes === nextProps.expenseTypes &&
    prevProps.provided.draggableProps.style === nextProps.provided.draggableProps.style
  );
});
