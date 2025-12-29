import { useState, useEffect, useMemo, useRef, useCallback, memo, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  Box,
  Button,
  Snackbar,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
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
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import RemoveDoneIcon from '@mui/icons-material/RemoveDone';
import './ExpenseSheet.css';
import { loadSheet, saveSheet, sheetExists, renameSheet } from '../storage/splitMoneyStore';
import SheetDrawer from '../components/SheetDrawer';
import { useExpenseCalculations } from '../hooks/useExpenseCalculations';
import { useSheetPersistence } from '../hooks/useSheetPersistence';
import { TotalsView } from '../components/ExpenseSheet/TotalsView';
import { DEFAULT_EXPENSE_TYPES, JSON_EXPORT_FILENAME } from '../constants/expenseSheet';
import { buildHashedColorMap, uniqueInsensitive } from '../utils/expenseUtils';

// Lazy load heavy components
const ChartsView = lazy(() => import('../components/ExpenseSheet/ChartsView').then(m => ({ default: m.ChartsView })));

// Debounced input component to prevent lag while typing
const DebouncedTextField = memo(function DebouncedTextField({ value, onChange, debounceMs = 400, ...props }) {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef(null);
  const latestOnChange = useRef(onChange);
  latestOnChange.current = onChange;

  // Sync local value when external value changes (e.g., from drag-drop reorder)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback((e) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      latestOnChange.current(newValue);
    }, debounceMs);
  }, [debounceMs]);

  // Flush on blur to ensure value is saved
  const handleBlur = useCallback((e) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    latestOnChange.current(localValue);
    if (props.onBlur) props.onBlur(e);
  }, [localValue, props.onBlur]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <TextField
      {...props}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
});


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

  const [editNamesOpen, setEditNamesOpen] = useState(false);
  const [draftParties, setDraftParties] = useState([]);
  const [draftExpenseTypes, setDraftExpenseTypes] = useState([]);
  const [draftVersion, setDraftVersion] = useState(0);
  const partyInputRefs = useRef([]);
  const typeInputRefs = useRef([]);

  const [splitBetweenForExpenseId, setSplitBetweenForExpenseId] = useState(null);
  const [splitBetweenSelection, setSplitBetweenSelection] = useState([]);

  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const [summaryTab, setSummaryTab] = useState(0);
  const [selectedParty, setSelectedParty] = useState('');

  const [expenses, setExpenses] = useState(importedExpenses.length > 0 ? importedExpenses : [
    { id: '1', description: '', cost: '', paidBy: '', type: DEFAULT_EXPENSE_TYPES[0] }
  ]);

  // Sync when navigation passes a different sheet via location.state
  useEffect(() => {
    const nextName = locationState.sheetName || '';
    if (!nextName || nextName === sheetName) return;

    const nextParties = Array.isArray(locationState.parties) ? locationState.parties : [];
    const nextExpenses = Array.isArray(locationState.expenses) && locationState.expenses.length
      ? locationState.expenses
      : [{ id: '1', description: '', cost: '', paidBy: '', type: DEFAULT_EXPENSE_TYPES[0] }];
    const nextTypes = Array.from(new Set([
      ...DEFAULT_EXPENSE_TYPES,
      ...((locationState.expenseTypes || []).filter(Boolean)),
    ]));

    setSheetName(nextName);
    setSheetNameInput(nextName);
    setParties(nextParties);
    setExpenses(nextExpenses);
    setExpenseTypes(nextTypes);
    setSelectedParty(nextParties[0] || '');
  }, [locationState, sheetName]);

  // Use custom hooks
  const { partyTotals, typeBreakdown, totalExpenses } = useExpenseCalculations(expenses, parties);
  useSheetPersistence(sheetName, parties, expenses, expenseTypes);

  // Initialize selectedParty when parties are loaded
  useEffect(() => {
    if (parties.length > 0 && !selectedParty) {
      setSelectedParty(parties[0]);
    }
  }, [parties, selectedParty]);

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

  const handleOpenDrawer = useCallback(() => setDrawerOpen(true), []);
  const handleCloseDrawer = useCallback(() => setDrawerOpen(false), []);

  const handleStartRename = useCallback(() => {
    setSheetNameInput(sheetName);
    setEditingSheetName(true);
  }, [sheetName]);

  const handleCancelRename = useCallback(() => {
    setEditingSheetName(false);
    setSheetNameInput(sheetName);
  }, [sheetName]);

  const handleConfirmRename = useCallback(async () => {
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
  }, [sheetNameInput, sheetName]);

  const handleCloseError = useCallback(() => setError(''), []);

  const openEditNames = useCallback(() => {
    setDraftParties(parties);
    setDraftExpenseTypes(expenseTypes);
    setDraftVersion((v) => v + 1); // force input remount for fresh defaults
    partyInputRefs.current = [];
    typeInputRefs.current = [];
    setEditNamesOpen(true);
  }, [expenseTypes, parties]);

  const closeEditNames = useCallback(() => {
    setEditNamesOpen(false);
  }, []);

  const saveEditedNames = useCallback(() => {
    const nextParties = draftParties.map((_, idx) => partyInputRefs.current[idx]?.value?.trim() || '').filter(Boolean);
    const nextTypes = draftExpenseTypes.map((_, idx) => typeInputRefs.current[idx]?.value?.trim() || '').filter(Boolean);

    if (nextParties.length === 0) {
      setError('At least one party is required');
      return;
    }
    if (!uniqueInsensitive(nextParties)) {
      setError('Party names must be unique');
      return;
    }
    if (nextTypes.length === 0) {
      setError('At least one expense type is required');
      return;
    }
    if (!uniqueInsensitive(nextTypes)) {
      setError('Expense types must be unique');
      return;
    }

    const partyRenameMap = new Map();
    for (let i = 0; i < parties.length; i += 1) {
      const oldName = parties[i];
      const newName = nextParties[i] ?? oldName;
      if (oldName && newName && oldName !== newName) partyRenameMap.set(oldName, newName);
    }

    const typeRenameMap = new Map();
    for (let i = 0; i < expenseTypes.length; i += 1) {
      const oldType = expenseTypes[i];
      const newType = nextTypes[i] ?? oldType;
      if (oldType && newType && oldType !== newType) typeRenameMap.set(oldType, newType);
    }

    setParties(nextParties);
    setExpenseTypes(nextTypes);

    if (partyRenameMap.size > 0 || typeRenameMap.size > 0) {
      setExpenses((prev) =>
        prev.map((exp) => {
          const paidBy = partyRenameMap.get(exp.paidBy) ?? exp.paidBy;
          const splitParties = Array.isArray(exp.splitParties)
            ? exp.splitParties.map((p) => partyRenameMap.get(p) ?? p)
            : exp.splitParties;
          const type = typeRenameMap.get(exp.type) ?? exp.type;

          return { ...exp, paidBy, splitParties, type };
        })
      );

      setSplitBetweenSelection((prev) =>
        Array.isArray(prev) ? prev.map((p) => partyRenameMap.get(p) ?? p) : prev
      );

      setSelectedParty((prev) => partyRenameMap.get(prev) ?? prev);
    }

    setEditNamesOpen(false);
  }, [draftParties, draftExpenseTypes, expenseTypes, parties]);

  const addExpense = useCallback(() => {
    setExpenses((prev) => [...prev, {
      id: Date.now().toString(),
      description: '',
      cost: '',
      paidBy: '',
      type: expenseTypes[0] || 'Other',
      splitParties: []
    }]);
  }, [expenseTypes]);

  const updateExpense = useCallback((id, field, value, extras = {}) => {
    setExpenses((prev) => prev.map((exp) =>
      exp.id === id ? { ...exp, [field]: value, ...extras } : exp
    ));
  }, []);

  const removeExpense = useCallback((id) => {
    setExpenses((prev) => prev.length > 1 ? prev.filter(exp => exp.id !== id) : prev);
  }, []);

  const handleDragEnd = useCallback((result) => {
    if (!result.destination) return;

    setExpenses((prev) => {
      const items = Array.from(prev);
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);
      return items;
    });
  }, []);

  const startCreateType = useCallback((expenseId) => {
    setNewTypeForExpenseId(expenseId);
    setNewTypeName('');
  }, []);

  const cancelCreateType = useCallback(() => {
    setNewTypeForExpenseId(null);
    setNewTypeName('');
  }, []);

  const confirmCreateType = useCallback(() => {
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
  }, [cancelCreateType, expenseTypes, newTypeForExpenseId, newTypeName, updateExpense]);

  const startCreateParty = useCallback((expenseId) => {
    setNewPartyForExpenseId(expenseId);
    setNewPartyName('');
  }, []);

  const cancelCreateParty = useCallback(() => {
    setNewPartyForExpenseId(null);
    setNewPartyName('');
  }, []);

  const confirmCreateParty = useCallback(() => {
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
  }, [cancelCreateParty, newPartyForExpenseId, newPartyName, parties, updateExpense]);

  const openSplitBetween = useCallback((expenseId) => {
    const exp = expenses.find((e) => e.id === expenseId);
    const existing = Array.isArray(exp?.splitParties) && exp.splitParties.length > 0 ? exp.splitParties : parties;
    setSplitBetweenSelection(existing);
    setSplitBetweenForExpenseId(expenseId);
  }, [expenses, parties]);

  const closeSplitBetween = useCallback(() => {
    setSplitBetweenForExpenseId(null);
    setSplitBetweenSelection([]);
  }, []);

  const toggleSplitParty = useCallback((party) => {
    setSplitBetweenSelection((prev) =>
      prev.includes(party) ? prev.filter((p) => p !== party) : [...prev, party],
    );
  }, []);

  const splitBetweenCheckAll = useCallback(() => setSplitBetweenSelection(parties), [parties]);
  const splitBetweenUncheckAll = useCallback(() => setSplitBetweenSelection([]), []);

  const confirmSplitBetween = useCallback(() => {
    if (!splitBetweenForExpenseId) return;
    if (splitBetweenSelection.length === 0) return;
    updateExpense(splitBetweenForExpenseId, 'paidBy', 'Split Between');
    updateExpense(splitBetweenForExpenseId, 'splitParties', splitBetweenSelection);
    closeSplitBetween();
  }, [closeSplitBetween, splitBetweenForExpenseId, splitBetweenSelection, updateExpense]);

  const handleExportPDF = useCallback(async () => {
    if (isExportingPDF) return;
    setIsExportingPDF(true);
    try {
      const { generatePDF } = await import('../components/ExpenseSheet/PDFExporter');
      await generatePDF(sheetName, expenses, parties, partyTotals, typeBreakdown, totalExpenses);
    } catch (err) {
      setError('Could not export PDF');
    } finally {
      setIsExportingPDF(false);
    }
  }, [isExportingPDF, sheetName, expenses, parties, partyTotals, typeBreakdown, totalExpenses]);

  const handleExportExcel = useCallback(async () => {
    if (isExportingExcel) return;
    setIsExportingExcel(true);
    try {
      const { generateExcel } = await import('../components/ExpenseSheet/ExcelExporter');
      await generateExcel(sheetName, expenses, parties, partyTotals, typeBreakdown, totalExpenses);
    } catch (err) {
      setError('Could not export Excel');
    } finally {
      setIsExportingExcel(false);
    }
  }, [isExportingExcel, sheetName, expenses, parties, partyTotals, typeBreakdown, totalExpenses]);

  const exportToJSON = useCallback(() => {
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
    a.download = JSON_EXPORT_FILENAME;
    a.click();
    URL.revokeObjectURL(url);
  }, [sheetName, parties, expenses, expenseTypes]);

  const typeColorMap = useMemo(
    () => buildHashedColorMap(typeBreakdown.map((t) => t.name)),
    [typeBreakdown]
  );

  if (!parties || parties.length === 0) {
    return null;
  }

  return (
    <div className="expense-sheet">
      <div className="sheet-header">
        <div>
          <div className="sheet-title">
            <ReceiptLongOutlinedIcon sx={{ color: 'var(--color-primary)' }} />
            <Typography variant="h3" component="h1" sx={{ color: 'var(--color-ink)' }}>Expense Tracker</Typography>
          </div>
          <p className="subtitle">{parties.length} parties tracking expenses</p>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>            <FolderOpenOutlinedIcon fontSize="small" sx={{ color: 'var(--color-primary)' }} />
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
          >
            Sheets
          </Button>
          <Button
            onClick={() => navigate('/')}
            variant="outlined"
            startIcon={<ArrowBackIcon />}
          >
            Back
          </Button>
          <Button
            onClick={handleExportPDF}
            variant="outlined"
            startIcon={<PictureAsPdfIcon />}
            disabled={isExportingPDF}
          >
            {isExportingPDF ? 'Generating...' : 'Export PDF'}
          </Button>
          <Button
            onClick={handleExportExcel}
            variant="outlined"
            startIcon={<FileDownloadOutlinedIcon />}
            disabled={isExportingExcel}
          >
            {isExportingExcel ? 'Generating...' : 'Export Excel'}
          </Button>
          <Button
            onClick={exportToJSON}
            variant="outlined"
            startIcon={<SaveOutlinedIcon />}
          >
            Save Data
          </Button>
          <Button
            onClick={openEditNames}
            variant="outlined"
            startIcon={<EditOutlinedIcon />}
          >
            Edit parties/types
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

          <div className="expense-list-container">
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
                            <DebouncedTextField
                              value={expense.name}
                              onChange={(val) => updateExpense(expense.id, 'name', val)}
                              placeholder="Enter expense name"
                              variant="outlined"
                              size="small"
                              fullWidth
                            />
                          </div>
                          <div className="col-cost">
                            <DebouncedTextField
                              type="number"
                              value={expense.cost}
                              onChange={(val) => updateExpense(expense.id, 'cost', val)}
                              placeholder="0.00"
                              variant="outlined"
                              size="small"
                              fullWidth
                              inputProps={{ step: '0.01' }}
                              InputProps={{ sx: { fontFamily: 'Courier New, monospace' } }}
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
          </div>

          <Button
            onClick={addExpense}
            variant="outlined"
            startIcon={<AddIcon />}
            fullWidth
            sx={{
              mt: 2,
              borderStyle: 'dashed',
              borderWidth: 2,
            }}
          >
            Add Expense
          </Button>
        </div>

        <div className="summary-section">
          <div className="summary-card">
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
              <div className={`summary-switch ${summaryTab === 0 ? 'is-left' : 'is-right'}`}>
                <ToggleButtonGroup
                  value={summaryTab}
                  exclusive
                  onChange={(_, next) => {
                    if (next !== null) setSummaryTab(next);
                  }}
                  aria-label="expense summary view"
                  className="summary-switch-group"
                >
                  <ToggleButton value={0} aria-label="charts" disableRipple>
                    📊 Charts
                  </ToggleButton>
                  <ToggleButton value={1} aria-label="totals" disableRipple>
                    💰 Totals
                  </ToggleButton>
                </ToggleButtonGroup>
              </div>
            </Box>
            {summaryTab === 0 && (
              <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}>
                <ChartsView
                  expenses={expenses}
                  parties={parties}
                  typeBreakdown={typeBreakdown}
                  partyTotals={partyTotals}
                  totalExpenses={totalExpenses}
                />
              </Suspense>
            )}

            {summaryTab === 1 && (
              <TotalsView
                parties={parties}
                partyTotals={partyTotals}
                totalExpenses={totalExpenses}
              />
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={Boolean(splitBetweenForExpenseId)}
        onClose={closeSplitBetween}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
          <PeopleAltOutlinedIcon sx={{ color: 'var(--color-primary)' }} />
          Split Between
        </DialogTitle>
        <DialogContent>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            mb: 2,
            '& img': {
              width: '140px',
              height: 'auto',
              opacity: 0.9,
            }
          }}>
            <img src="/images/Saving money-pana.svg" alt="Split expenses" />
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, textAlign: 'center' }}>
            Choose which parties share this expense.
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Button
              onClick={splitBetweenCheckAll}
              size="small"
              variant="outlined"
              startIcon={<SelectAllIcon />}
            >
              Check all
            </Button>
            <Button
              onClick={splitBetweenUncheckAll}
              size="small"
              variant="outlined"
              startIcon={<RemoveDoneIcon />}
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
          >
            Cancel
          </Button>
          <Button
            onClick={confirmSplitBetween}
            variant="contained"
            startIcon={<CheckIcon />}
            disabled={splitBetweenSelection.length === 0}
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editNamesOpen}
        onClose={closeEditNames}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Edit parties & expense types</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="subtitle2" sx={{ mt: 1, mb: 1, fontWeight: 700, color: 'text.secondary' }}>
            Parties
          </Typography>
          <Box sx={{ display: 'grid', gap: 1 }}>
            {draftParties.map((p, idx) => (
              <TextField
                key={`party-${draftVersion}-${idx}`}
                defaultValue={p}
                size="small"
                fullWidth
                inputRef={(el) => { partyInputRefs.current[idx] = el; }}
              />
            ))}
          </Box>

          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1, fontWeight: 700, color: 'text.secondary' }}>
            Expense types
          </Typography>
          <Box sx={{ display: 'grid', gap: 1 }}>
            {draftExpenseTypes.map((t, idx) => (
              <TextField
                key={`type-${draftVersion}-${idx}`}
                defaultValue={t}
                size="small"
                fullWidth
                inputRef={(el) => { typeInputRefs.current[idx] = el; }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={closeEditNames} variant="outlined" startIcon={<CloseIcon />}>
            Cancel
          </Button>
          <Button onClick={saveEditedNames} variant="contained" startIcon={<CheckIcon />}>
            Save
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
        <Alert severity="error" onClose={handleCloseError}>
          {error}
        </Alert>
      </Snackbar>
    </div>
  );
}

export default ExpenseSheet;
