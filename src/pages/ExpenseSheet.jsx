import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Box, Button, IconButton, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import * as XLSX from 'xlsx';
import './ExpenseSheet.css';
import { loadAppData, patchAppData } from '../storage/splitMoneyStore';

import {
  red,
  pink,
  purple,
  deepPurple,
  indigo,
  blue,
  lightBlue,
  cyan,
  teal,
  green,
  lightGreen,
  lime,
  yellow,
  amber,
  orange,
  deepOrange,
  brown,
} from '@mui/material/colors';

const DEFAULT_EXPENSE_TYPES = ['Food', 'Transport', 'Accommodation', 'Entertainment', 'Shopping', 'Other'];

const SWATCHES = [
  red[700],
  pink[600],
  purple[600],
  deepPurple[600],
  indigo[600],
  blue[700],
  lightBlue[700],
  cyan[700],
  teal[700],
  green[700],
  lightGreen[700],
  lime[800],
  yellow[800],
  amber[800],
  orange[800],
  deepOrange[800],
  brown[600],
];

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

const formatINR = (amount) => {
  const value = Number(amount) || 0;
  return value.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
};

function ExpenseSheet() {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state || {};
  const initialParties = Array.isArray(locationState.parties) ? locationState.parties : [];
  const importedExpenses = Array.isArray(locationState.expenses) ? locationState.expenses : [];

  const [parties, setParties] = useState(initialParties);

  const [expenseTypes, setExpenseTypes] = useState(() => {
    const importedTypes = (importedExpenses || []).map((e) => e?.type).filter(Boolean);
    return Array.from(new Set([...DEFAULT_EXPENSE_TYPES, ...importedTypes]));
  });

  const [newTypeForExpenseId, setNewTypeForExpenseId] = useState(null);
  const [newTypeName, setNewTypeName] = useState('');

  const [newPartyForExpenseId, setNewPartyForExpenseId] = useState(null);
  const [newPartyName, setNewPartyName] = useState('');

  const [expenses, setExpenses] = useState(importedExpenses.length > 0 ? importedExpenses : [
    { id: '1', name: '', cost: '', paidBy: '', type: DEFAULT_EXPENSE_TYPES[0] }
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (initialParties.length > 0) return;
      try {
        const saved = await loadAppData();
        if (cancelled) return;
        if (!saved) {
          navigate('/');
          return;
        }

        const savedParties = Array.isArray(saved.parties) ? saved.parties : [];
        const savedExpenses = Array.isArray(saved.expenses) ? saved.expenses : [];
        const savedTypes = Array.isArray(saved.expenseTypes) ? saved.expenseTypes : [];

        if (savedParties.length > 0) {
          setParties(savedParties);
          if (savedExpenses.length > 0) setExpenses(savedExpenses);
          if (savedTypes.length > 0) {
            setExpenseTypes(Array.from(new Set([...DEFAULT_EXPENSE_TYPES, ...savedTypes])));
          }
        } else {
          navigate('/');
        }
      } catch {
        navigate('/');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialParties.length, navigate]);

  useEffect(() => {
    if (!parties || parties.length === 0) return;
    const t = setTimeout(() => {
      patchAppData({ parties, expenses, expenseTypes }).catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [parties, expenses, expenseTypes]);

  const addExpense = () => {
    setExpenses([...expenses, {
      id: Date.now().toString(),
      name: '',
      cost: '',
      paidBy: '',
      type: expenseTypes[0] || 'Other'
    }]);
  };

  const updateExpense = (id, field, value) => {
    setExpenses(expenses.map(exp =>
      exp.id === id ? { ...exp, [field]: value } : exp
    ));
  };

  const removeExpense = (id) => {
    if (expenses.length > 1) {
      setExpenses(expenses.filter(exp => exp.id !== id));
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(expenses);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setExpenses(items);
  };

  const calculatePartyTotals = () => {
    const totals = {};
    parties.forEach((party) => {
      totals[party] = { direct: 0, split: 0, total: 0 };
    });

    expenses.forEach((expense) => {
      const cost = parseFloat(expense.cost) || 0;
      const paidBy = expense.paidBy;
      if (!paidBy || cost <= 0) return;

      if (paidBy === 'Split Equally') {
        const perPerson = cost / parties.length;
        parties.forEach((party) => {
          totals[party].split += perPerson;
        });
        return;
      }

      if (totals[paidBy] !== undefined) {
        totals[paidBy].direct += cost;
      }
    });

    parties.forEach((party) => {
      totals[party].total = totals[party].direct + totals[party].split;
    });

    return totals;
  };

  const calculateTypeBreakdown = () => {
    const breakdown = {};
    expenses.forEach(expense => {
      const cost = parseFloat(expense.cost) || 0;
      if (cost > 0 && expense.type) {
        breakdown[expense.type] = (breakdown[expense.type] || 0) + cost;
      }
    });
    return Object.entries(breakdown).map(([name, value]) => ({ name, value }));
  };

  const startCreateType = (expenseId) => {
    setNewTypeForExpenseId(expenseId);
    setNewTypeName('');
  };

  const cancelCreateType = () => {
    setNewTypeForExpenseId(null);
    setNewTypeName('');
  };

  const confirmCreateType = () => {
    const candidate = newTypeName.trim();
    if (!candidate) return;
    const exists = expenseTypes.some((t) => t.toLowerCase() === candidate.toLowerCase());
    const finalType = exists ? expenseTypes.find((t) => t.toLowerCase() === candidate.toLowerCase()) : candidate;
    if (!exists) {
      setExpenseTypes((prev) => [...prev, candidate]);
    }
    if (newTypeForExpenseId) {
      updateExpense(newTypeForExpenseId, 'type', finalType);
    }
    cancelCreateType();
  };

  const startCreateParty = (expenseId) => {
    setNewPartyForExpenseId(expenseId);
    setNewPartyName('');
  };

  const cancelCreateParty = () => {
    setNewPartyForExpenseId(null);
    setNewPartyName('');
  };

  const confirmCreateParty = () => {
    const candidate = newPartyName.trim();
    if (!candidate) return;

    const exists = parties.some((p) => p.toLowerCase() === candidate.toLowerCase());
    const finalParty = exists ? parties.find((p) => p.toLowerCase() === candidate.toLowerCase()) : candidate;

    if (!exists) {
      setParties((prev) => [...prev, candidate]);
    }

    if (newPartyForExpenseId) {
      updateExpense(newPartyForExpenseId, 'paidBy', finalParty);
    }

    cancelCreateParty();
  };

  const exportToExcel = () => {
    const exportData = expenses.map(exp => ({
      'Expense Name': exp.name,
      'Cost': exp.cost,
      'Paid By': exp.paidBy,
      'Type': exp.type
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    XLSX.writeFile(wb, 'expenses.xlsx');
  };

  const exportToJSON = () => {
    const data = {
      parties,
      expenses,
      expenseTypes,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'split-money-data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const partyTotals = calculatePartyTotals();
  const typeBreakdown = calculateTypeBreakdown();
  const typeColorMap = buildTypeColorMap(typeBreakdown.map((t) => t.name));
  const totalExpenses = expenses.reduce((sum, exp) => sum + (parseFloat(exp.cost) || 0), 0);

  if (!parties || parties.length === 0) {
    return null;
  }

  return (
    <div className="expense-sheet">
      <div className="sheet-header">
        <div>
          <div className="sheet-title">
            <ReceiptLongOutlinedIcon sx={{ color: 'var(--color-primary)' }} />
            <Typography variant="h3" component="h1">Expense Tracker</Typography>
          </div>
          <p className="subtitle">{parties.length} parties tracking expenses</p>
        </div>
        <div className="header-actions">
          <Button
            onClick={() => navigate('/')}
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            sx={{ borderRadius: 0, borderColor: 'var(--color-primary)', color: 'var(--color-ink)' }}
          >
            Back
          </Button>
          <Button
            onClick={exportToExcel}
            variant="outlined"
            startIcon={<FileDownloadOutlinedIcon />}
            sx={{ borderRadius: 0, borderColor: 'var(--color-primary)', color: 'var(--color-ink)' }}
          >
            Export Excel
          </Button>
          <Button
            onClick={exportToJSON}
            variant="outlined"
            startIcon={<SaveOutlinedIcon />}
            sx={{ borderRadius: 0, borderColor: 'var(--color-primary)', color: 'var(--color-ink)' }}
          >
            Save Data
          </Button>
        </div>
      </div>

      <div className="sheet-content">
        <div className="expenses-section">
          <div className="table-header">
            <div className="col-drag"></div>
            <div className="col-name">Expense Name</div>
            <div className="col-cost">Cost</div>
            <div className="col-paidby">Paid By</div>
            <div className="col-type">Type</div>
            <div className="col-actions"></div>
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="expenses">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="expense-list"
                >
                  {expenses.map((expense, index) => (
                    <Draggable key={expense.id} draggableId={expense.id} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className="expense-row"
                        >
                          <div className="col-drag" {...provided.dragHandleProps}>
                            <DragIndicatorIcon fontSize="small" />
                          </div>
                          <div className="col-name">
                            <TextField
                              value={expense.name}
                              onChange={(e) => updateExpense(expense.id, 'name', e.target.value)}
                              placeholder="Enter expense name"
                              variant="outlined"
                              size="small"
                              fullWidth
                              InputProps={{ sx: { borderRadius: 0 } }}
                            />
                          </div>
                          <div className="col-cost">
                            <TextField
                              type="number"
                              value={expense.cost}
                              onChange={(e) => updateExpense(expense.id, 'cost', e.target.value)}
                              placeholder="0.00"
                              variant="outlined"
                              size="small"
                              fullWidth
                              inputProps={{ step: '0.01' }}
                              InputProps={{ sx: { borderRadius: 0, fontFamily: 'Courier New, monospace' } }}
                            />
                          </div>
                          <div className="col-paidby">
                            {newPartyForExpenseId === expense.id ? (
                              <Box className="new-type-inline">
                                <TextField
                                  value={newPartyName}
                                  onChange={(e) => setNewPartyName(e.target.value)}
                                  placeholder="New party"
                                  variant="outlined"
                                  size="small"
                                  fullWidth
                                  autoFocus
                                  InputProps={{ sx: { borderRadius: 0 } }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') confirmCreateParty();
                                    if (e.key === 'Escape') cancelCreateParty();
                                  }}
                                />
                                <IconButton className="new-type-btn" onClick={confirmCreateParty} aria-label="Confirm party">
                                  <CheckIcon fontSize="small" />
                                </IconButton>
                                <IconButton className="new-type-btn" onClick={cancelCreateParty} aria-label="Cancel">
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            ) : (
                              <Select
                                value={expense.paidBy}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === '__add_new_party__') {
                                    startCreateParty(expense.id);
                                    return;
                                  }
                                  updateExpense(expense.id, 'paidBy', value);
                                }}
                                size="small"
                                fullWidth
                                displayEmpty
                                sx={{ borderRadius: 0 }}
                              >
                                <MenuItem value=""><em>Select…</em></MenuItem>
                                <MenuItem value="Split Equally">Split Equally</MenuItem>
                                {parties.map((party) => (
                                  <MenuItem key={party} value={party}>{party}</MenuItem>
                                ))}
                                <MenuItem value="__add_new_party__"><em>+ Add new party…</em></MenuItem>
                              </Select>
                            )}
                          </div>
                          <div className="col-type">
                            {newTypeForExpenseId === expense.id ? (
                              <Box className="new-type-inline">
                                <TextField
                                  value={newTypeName}
                                  onChange={(e) => setNewTypeName(e.target.value)}
                                  placeholder="New type"
                                  variant="outlined"
                                  size="small"
                                  fullWidth
                                  autoFocus
                                  InputProps={{ sx: { borderRadius: 0 } }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') confirmCreateType();
                                    if (e.key === 'Escape') cancelCreateType();
                                  }}
                                />
                                <IconButton className="new-type-btn" onClick={confirmCreateType} aria-label="Confirm type">
                                  <CheckIcon fontSize="small" />
                                </IconButton>
                                <IconButton className="new-type-btn" onClick={cancelCreateType} aria-label="Cancel">
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            ) : (
                              <Select
                                value={expense.type}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === '__add_new_type__') {
                                    startCreateType(expense.id);
                                    return;
                                  }
                                  updateExpense(expense.id, 'type', value);
                                }}
                                size="small"
                                fullWidth
                                sx={{ borderRadius: 0 }}
                              >
                                {expenseTypes.map((type) => (
                                  <MenuItem key={type} value={type}>{type}</MenuItem>
                                ))}
                                <MenuItem value="__add_new_type__"><em>+ Add new type…</em></MenuItem>
                              </Select>
                            )}
                          </div>
                          <div className="col-actions">
                            <IconButton
                              onClick={() => removeExpense(expense.id)}
                              className="btn-delete"
                              disabled={expenses.length === 1}
                              aria-label="Delete expense"
                              size="small"
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          <Button
            onClick={addExpense}
            variant="outlined"
            startIcon={<AddIcon />}
            fullWidth
            sx={{
              mt: 2,
              borderRadius: 0,
              borderStyle: 'dashed',
              borderColor: 'var(--color-gray-400)',
              color: 'var(--color-gray-500)',
            }}
          >
            Add Expense
          </Button>
        </div>

        <div className="summary-section">
          <div className="summary-card">
            <h3>Total Expenses</h3>
            <div className="total-amount">{formatINR(totalExpenses)}</div>
          </div>

          {typeBreakdown.length > 0 && (
            <div className="summary-card">
              <h3>Expense by Type</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={typeBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                  >
                    {typeBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={typeColorMap[entry.name] || SWATCHES[index % SWATCHES.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatINR(value)} />
                </PieChart>
              </ResponsiveContainer>

              <div className="chart-legend" aria-label="Expense type legend">
                {typeBreakdown
                  .slice()
                  .sort((a, b) => b.value - a.value)
                  .map((item) => (
                    <div key={item.name} className="legend-item">
                      <span
                        className="legend-swatch"
                        style={{ backgroundColor: typeColorMap[item.name] || 'var(--color-primary)' }}
                      />
                      <span className="legend-name">{item.name}</span>
                      <span className="legend-value">{formatINR(item.value)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="summary-card">
            <h3>Party Totals</h3>
            <div className="balance-list">
              {parties.map(party => {
                const totals = partyTotals[party];
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExpenseSheet;
