import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  Box,
  Button,
  Checkbox,
  Snackbar,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import RemoveDoneIcon from '@mui/icons-material/RemoveDone';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import * as XLSX from 'xlsx';
import './ExpenseSheet.css';
import { loadSheet, saveSheet, sheetExists, renameSheet } from '../storage/splitMoneyStore';
import SheetDrawer from '../components/SheetDrawer';

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
  const initialSheetName = locationState.sheetName || '';
  const initialParties = Array.isArray(locationState.parties) ? locationState.parties : [];
  const importedExpenses = Array.isArray(locationState.expenses) ? locationState.expenses : [];

  const [sheetName, setSheetName] = useState(initialSheetName);
  const [sheetNameInput, setSheetNameInput] = useState(initialSheetName);
  const [editingSheetName, setEditingSheetName] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [error, setError] = useState('');

  const [parties, setParties] = useState(initialParties);

  const [expenseTypes, setExpenseTypes] = useState(() => {
    const importedTypes = (importedExpenses || []).map((e) => e?.type).filter(Boolean);
    return Array.from(new Set([...DEFAULT_EXPENSE_TYPES, ...importedTypes]));
  });

  const [newTypeForExpenseId, setNewTypeForExpenseId] = useState(null);
  const [newTypeName, setNewTypeName] = useState('');

  const [newPartyForExpenseId, setNewPartyForExpenseId] = useState(null);
  const [newPartyName, setNewPartyName] = useState('');

  const [splitBetweenForExpenseId, setSplitBetweenForExpenseId] = useState(null);
  const [splitBetweenSelection, setSplitBetweenSelection] = useState([]);

  const [expenses, setExpenses] = useState(importedExpenses.length > 0 ? importedExpenses : [
    { id: '1', name: '', cost: '', paidBy: '', type: DEFAULT_EXPENSE_TYPES[0] }
  ]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!sheetName) {
        navigate('/');
        return;
      }

      try {
        const stored = await loadSheet(sheetName);
        if (cancelled) return;

        if (stored) {
          setParties(Array.isArray(stored.parties) && stored.parties.length ? stored.parties : []);
          setExpenses(Array.isArray(stored.expenses) && stored.expenses.length ? stored.expenses : [{ id: '1', name: '', cost: '', paidBy: '', type: DEFAULT_EXPENSE_TYPES[0] }]);
          const storedTypes = Array.isArray(stored.expenseTypes) && stored.expenseTypes.length ? stored.expenseTypes : DEFAULT_EXPENSE_TYPES;
          setExpenseTypes(Array.from(new Set([...DEFAULT_EXPENSE_TYPES, ...storedTypes])));
        } else if (initialParties.length > 0) {
          const mergedTypes = Array.from(new Set([...DEFAULT_EXPENSE_TYPES, ...(locationState.expenseTypes || [])]));
          const initialExpenses = importedExpenses.length > 0 ? importedExpenses : [{ id: '1', name: '', cost: '', paidBy: '', type: mergedTypes[0] || DEFAULT_EXPENSE_TYPES[0] }];
          setParties(initialParties);
          setExpenses(initialExpenses);
          setExpenseTypes(mergedTypes);
          await saveSheet({ name: sheetName, parties: initialParties, expenses: initialExpenses, expenseTypes: mergedTypes });
        } else {
          navigate('/');
        }
      } catch {
        if (!cancelled) navigate('/');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sheetName, initialParties.length, importedExpenses.length, navigate, locationState.expenseTypes]);

  useEffect(() => {
    if (!sheetName) return;
    const t = setTimeout(() => {
      saveSheet({ name: sheetName, parties, expenses, expenseTypes }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [sheetName, parties, expenses, expenseTypes]);

  const handleOpenDrawer = () => setDrawerOpen(true);
  const handleCloseDrawer = () => setDrawerOpen(false);

  const handleStartRename = () => {
    setSheetNameInput(sheetName);
    setEditingSheetName(true);
  };

  const handleCancelRename = () => {
    setEditingSheetName(false);
    setSheetNameInput(sheetName);
  };

  const handleConfirmRename = async () => {
    const trimmed = sheetNameInput.trim();
    if (!trimmed) {
      setError('Sheet name is required');
      return;
    }
    if (trimmed.toLowerCase() === sheetName.toLowerCase()) {
      setEditingSheetName(false);
      return;
    }
    const exists = await sheetExists(trimmed);
    if (exists) {
      setError('A sheet with this name already exists');
      return;
    }
    try {
      await renameSheet(sheetName, trimmed);
      setSheetName(trimmed);
      setEditingSheetName(false);
    } catch {
      setError('Could not rename sheet');
    }
  };

  const handleCloseError = () => setError('');

  const addExpense = () => {
    setExpenses([...expenses, {
      id: Date.now().toString(),
      name: '',
      cost: '',
      paidBy: '',
      type: expenseTypes[0] || 'Other',
      splitParties: parties
    }]);
  };

  const updateExpense = (id, field, value, extras = {}) => {
    setExpenses((prev) => prev.map((exp) =>
      exp.id === id ? { ...exp, [field]: value, ...extras } : exp
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

      if (paidBy === 'Split Between') {
        const selected = Array.isArray(expense.splitParties) && expense.splitParties.length > 0
          ? expense.splitParties
          : parties;
        const perPerson = cost / selected.length;
        selected.forEach((party) => {
          if (totals[party] !== undefined) {
            totals[party].split += perPerson;
          }
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

  const openSplitBetween = (expenseId) => {
    const exp = expenses.find((e) => e.id === expenseId);
    const existing = Array.isArray(exp?.splitParties) && exp.splitParties.length > 0 ? exp.splitParties : parties;
    setSplitBetweenSelection(existing);
    setSplitBetweenForExpenseId(expenseId);
  };

  const closeSplitBetween = () => {
    setSplitBetweenForExpenseId(null);
    setSplitBetweenSelection([]);
  };

  const toggleSplitParty = (party) => {
    setSplitBetweenSelection((prev) =>
      prev.includes(party) ? prev.filter((p) => p !== party) : [...prev, party],
    );
  };

  const splitBetweenCheckAll = () => setSplitBetweenSelection(parties);
  const splitBetweenUncheckAll = () => setSplitBetweenSelection([]);

  const confirmSplitBetween = () => {
    if (!splitBetweenForExpenseId) return;
    if (splitBetweenSelection.length === 0) return;
    updateExpense(splitBetweenForExpenseId, 'paidBy', 'Split Between');
    updateExpense(splitBetweenForExpenseId, 'splitParties', splitBetweenSelection);
    closeSplitBetween();
  };

  const exportToExcel = () => {
    const exportData = expenses.map(exp => ({
      'Expense Name': exp.name,
      'Cost': exp.cost,
      'Paid By': exp.paidBy,
      'Type': exp.type,
      'Split Parties': exp.paidBy === 'Split Between'
        ? (Array.isArray(exp.splitParties) ? exp.splitParties.join(', ') : '')
        : ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    XLSX.writeFile(wb, 'expenses.xlsx');
  };

  const exportToJSON = () => {
    const data = {
      name: sheetName,
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <FolderOpenOutlinedIcon fontSize="small" sx={{ color: 'var(--color-primary)' }} />
            {editingSheetName ? (
              <>
                <TextField
                  value={sheetNameInput}
                  onChange={(e) => setSheetNameInput(e.target.value)}
                  size="small"
                  variant="outlined"
                  InputProps={{ sx: { borderRadius: 0, fontWeight: 700, minWidth: 180 } }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmRename();
                    if (e.key === 'Escape') handleCancelRename();
                  }}
                />
                <IconButton onClick={handleConfirmRename} size="small" aria-label="Save sheet name">
                  <CheckIcon fontSize="small" />
                </IconButton>
                <IconButton onClick={handleCancelRename} size="small" aria-label="Cancel rename">
                  <CloseIcon fontSize="small" />
                </IconButton>
              </>
            ) : (
              <>
                <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
                  {sheetName}
                </Typography>
                <IconButton onClick={handleStartRename} size="small" aria-label="Edit sheet name">
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </>
            )}
          </Box>
        </div>
        <div className="header-actions">
          <Button
            onClick={handleOpenDrawer}
            variant="outlined"
            startIcon={<FolderOpenOutlinedIcon />}
            sx={{ borderRadius: 0, borderColor: 'var(--color-primary)', color: 'var(--color-ink)' }}
          >
            Sheets
          </Button>
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
            <div className="col-serial">#</div>
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
                          <div className="col-serial">{index + 1}</div>
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
                                  if (value === '__split_between__') {
                                    updateExpense(
                                      expense.id,
                                      'paidBy',
                                      'Split Between',
                                      { splitParties: Array.isArray(expense.splitParties) && expense.splitParties.length > 0 ? expense.splitParties : parties }
                                    );
                                    openSplitBetween(expense.id);
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
                                <MenuItem value="Split Between" sx={{ display: 'none' }}>Split Between</MenuItem>
                                {parties.map((party) => (
                                  <MenuItem key={party} value={party}>{party}</MenuItem>
                                ))}
                                <MenuItem value="__split_between__"><em>Split Between…</em></MenuItem>
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

      <Dialog
        open={Boolean(splitBetweenForExpenseId)}
        onClose={closeSplitBetween}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PeopleAltOutlinedIcon sx={{ color: 'var(--color-primary)' }} />
          Split Between
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Choose which parties share this expense.
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Button
              onClick={splitBetweenCheckAll}
              size="small"
              variant="outlined"
              startIcon={<SelectAllIcon />}
              sx={{ borderRadius: 0, borderColor: 'var(--color-primary)', color: 'var(--color-ink)' }}
            >
              Check all
            </Button>
            <Button
              onClick={splitBetweenUncheckAll}
              size="small"
              variant="outlined"
              startIcon={<RemoveDoneIcon />}
              sx={{ borderRadius: 0, borderColor: 'var(--color-primary)', color: 'var(--color-ink)' }}
            >
              Uncheck all
            </Button>
          </Box>

          <FormGroup>
            {parties.map((party) => (
              <FormControlLabel
                key={party}
                control={
                  <Checkbox
                    checked={splitBetweenSelection.includes(party)}
                    onChange={() => toggleSplitParty(party)}
                    sx={{ '&.Mui-checked': { color: 'var(--color-primary)' } }}
                  />
                }
                label={party}
              />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={closeSplitBetween}
            variant="outlined"
            startIcon={<CloseIcon />}
            sx={{ borderRadius: 0, borderColor: 'var(--color-primary)', color: 'var(--color-ink)' }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmSplitBetween}
            variant="contained"
            startIcon={<CheckIcon />}
            disabled={splitBetweenSelection.length === 0}
            sx={{ borderRadius: 0, backgroundColor: 'var(--color-primary)' }}
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>

      <SheetDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        currentSheetName={sheetName}
      />

      <Snackbar
        open={Boolean(error)}
        autoHideDuration={4000}
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={handleCloseError} sx={{ borderRadius: 0 }}>
          {error}
        </Alert>
      </Snackbar>
    </div>
  );
}

export default ExpenseSheet;
