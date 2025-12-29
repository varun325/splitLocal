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

// Lazy load heavy components
const ChartsView = lazy(() => import('../components/ExpenseSheet/ChartsView').then(m => ({ default: m.ChartsView })));
const PDFExporter = lazy(() => import('../components/ExpenseSheet/PDFExporter').then(m => ({ default: m.PDFExporter })));
const ExcelExporter = lazy(() => import('../components/ExpenseSheet/ExcelExporter').then(m => ({ default: m.ExcelExporter })));

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

const parseAmount = (value) => {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/,/g, '').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const formatINRNumber = (amount) => {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

const formatINRForPdf = (amount) => `INR ${formatINRNumber(amount)}`;

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

  const [editNamesOpen, setEditNamesOpen] = useState(false);
  const [draftParties, setDraftParties] = useState([]);
  const [draftExpenseTypes, setDraftExpenseTypes] = useState([]);

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

  const openEditNames = () => {
    setDraftParties(parties);
    setDraftExpenseTypes(expenseTypes);
    setEditNamesOpen(true);
  };

  const closeEditNames = () => {
    setEditNamesOpen(false);
  };

  const saveEditedNames = () => {
    const nextPartiesRaw = Array.isArray(draftParties) ? draftParties : [];
    const nextTypesRaw = Array.isArray(draftExpenseTypes) ? draftExpenseTypes : [];

    const nextParties = nextPartiesRaw.map((p) => String(p ?? '').trim()).filter(Boolean);
    const nextTypes = nextTypesRaw.map((t) => String(t ?? '').trim()).filter(Boolean);

    const uniqueInsensitive = (items) => {
      const seen = new Set();
      for (const item of items) {
        const key = item.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
      }
      return true;
    };

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
  };

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

  const drawPieToCanvas = ({ slices, colors, size = 520 }) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const cx = size / 2;
    const cy = size / 2;
    const radius = Math.floor(size * 0.36);

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    const total = slices.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
    if (total <= 0) {
      ctx.strokeStyle = '#999999';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      return canvas;
    }

    let startAngle = -Math.PI / 2;
    slices.forEach((s, idx) => {
      const value = Number(s.value) || 0;
      if (value <= 0) return;
      const angle = (value / total) * Math.PI * 2;
      const endAngle = startAngle + angle;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = colors[idx % colors.length];
      ctx.fill();

      startAngle = endAngle;
    });

    // subtle center cut for modern donut look
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx, cy, Math.floor(radius * 0.55), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // center label
    ctx.fillStyle = '#111111';
    ctx.font = '700 28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Total', cx, cy - 16);
    ctx.font = '700 26px Arial';
    ctx.fillText(formatINRForPdf(total), cx, cy + 18);

    return canvas;
  };

  const exportToPDF = async () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;

    const nowStr = new Date().toLocaleString();
    const grandTotal = totalExpenses;

    const ensureSpace = (neededHeight, cursorY) => {
      if (cursorY + neededHeight > pageHeight - margin) {
        doc.addPage();
        return margin;
      }
      return cursorY;
    };

    // Load illustration for header (Innovation-bro.svg like the app header)
    let headerIllustration = null;
    try {
      const response = await fetch('/images/Innovation-bro.svg');
      const svgText = await response.text();
      const img = new Image();
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
        img.src = 'data:image/svg+xml;base64,' + btoa(svgText);
      });
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, 300, 300);
        headerIllustration = canvas.toDataURL('image/png');
      }
    } catch (e) {
      // illustration optional
    }

    // Soft cream header inspired by app design
    doc.setFillColor(246, 240, 215); // #F6F0D7
    doc.rect(0, 0, pageWidth, 110, 'F');
    
    // Add illustration to header if loaded (constrained within bounds)
    if (headerIllustration) {
      doc.setGState(new doc.GState({ opacity: 0.25 }));
      doc.addImage(headerIllustration, 'PNG', pageWidth - 150, 10, 120, 120);
      doc.setGState(new doc.GState({ opacity: 1 }));
    }

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('Expense Report', margin, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text(`${sheetName || 'Untitled Sheet'}`, margin, 64);
    doc.setFontSize(9);
    doc.text(`Generated: ${nowStr}`, margin, 84);

    // Summary card with white background
    let cursorY = 134;
    doc.setTextColor(15, 23, 42);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    
    // White background
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, cursorY, contentWidth, 80, 8, 8, 'FD');
    
    // Green accent bar on left
    doc.setFillColor(137, 152, 109); // #89986D
    doc.roundedRect(margin, cursorY, 6, 80, 3, 3, 'F');
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text('TOTAL EXPENSES', margin + 20, cursorY + 28);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(15, 23, 42);
    doc.text(formatINRForPdf(grandTotal), margin + 20, cursorY + 56);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`${parties.length} parties • ${expenses.length} expenses`, margin + contentWidth - 20, cursorY + 44, { align: 'right' });

    cursorY += 100;

    // Build party totals list
    const partyRows = parties.map((party) => {
      const t = partyTotals[party] || { direct: 0, split: 0, total: 0 };
      return {
        party,
        direct: t.direct,
        split: t.split,
        total: t.total,
      };
    }).sort((a, b) => b.total - a.total);

    // Party totals table with natural palette
    const partyCol0 = Math.floor(contentWidth * 0.46);
    const partyNum = Math.floor((contentWidth - partyCol0) / 3);
    const partyLast = contentWidth - partyCol0 - partyNum * 2;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('Party Breakdown', margin, cursorY);
    cursorY += 8;
    
    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      head: [['Party', 'Direct', 'Split', 'Total']],
      body: partyRows.map((r) => [r.party, formatINRForPdf(r.direct), formatINRForPdf(r.split), formatINRForPdf(r.total)]),
      styles: { 
        font: 'helvetica', 
        fontSize: 10, 
        cellPadding: 8, 
        lineColor: [226, 232, 240],
        lineWidth: 1,
        textColor: [15, 23, 42]
      },
      headStyles: { 
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42], 
        fontStyle: 'bold',
        fontSize: 10
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: partyCol0, fontStyle: 'bold' },
        1: { cellWidth: partyNum, halign: 'right' },
        2: { cellWidth: partyNum, halign: 'right' },
        3: { cellWidth: partyLast, halign: 'right', fontStyle: 'bold' },
      },
    });

    cursorY = (doc.lastAutoTable?.finalY || cursorY) + 18;

    // Charts page (stacked blocks for readability)
    doc.addPage();
    cursorY = margin;

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Visual Analytics', margin, cursorY);
    cursorY += 16;

    const makeSlices = (rawItems, colorPicker) => {
      const items = rawItems
        .slice()
        .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
        .map((it, idx) => ({
          label: String(it.label),
          value: Number(it.value) || 0,
          color: colorPicker(it, idx),
        }))
        .filter((it) => it.value > 0);

      const max = 10;
      if (items.length <= max) return items;
      const top = items.slice(0, max);
      const rest = items.slice(max);
      const others = rest.reduce((sum, it) => sum + it.value, 0);
      top.push({ label: 'Others', value: others, color: '#888888' });
      return top;
    };

    const buildLegendRows = (items) => {
      const total = items.reduce((sum, it) => sum + (Number(it.value) || 0), 0) || 1;
      return items.map((it) => {
        const pct = Math.round((it.value / total) * 1000) / 10;
        return [it.color, it.label, formatINRForPdf(it.value), `${pct}%`];
      });
    };

    const computePartyTypeBreakdowns = () => {
      const map = {};
      parties.forEach((p) => { map[p] = {}; });

      expenses.forEach((exp) => {
        const cost = parseAmount(exp.cost);
        if (cost <= 0) return;
        const type = exp.type || 'Other';
        const paidBy = exp.paidBy;
        if (!paidBy) return;

        if (paidBy === 'Split Equally') {
          const per = cost / Math.max(parties.length, 1);
          parties.forEach((p) => { map[p][type] = (map[p][type] || 0) + per; });
          return;
        }

        if (paidBy === 'Split Between') {
          const selected = Array.isArray(exp.splitParties) && exp.splitParties.length > 0 ? exp.splitParties : parties;
          const per = cost / Math.max(selected.length, 1);
          selected.forEach((p) => {
            if (!map[p]) map[p] = {};
            map[p][type] = (map[p][type] || 0) + per;
          });
          return;
        }

        if (map[paidBy]) {
          map[paidBy][type] = (map[paidBy][type] || 0) + cost;
        }
      });

      return map;
    };

    const drawChartBlock = (title, slices) => {
      cursorY = ensureSpace(340, cursorY);
      
      // Section header with minimal accent
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, cursorY, contentWidth, 36, 6, 6, 'F');
      doc.setFillColor(137, 152, 109); // #89986D
      doc.roundedRect(margin, cursorY, 4, 36, 2, 2, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(title, margin + 16, cursorY + 23);

      cursorY += 46;

      const chartSize = 420;
      const pieCanvas = drawPieToCanvas({
        slices,
        colors: slices.map((s) => s.color),
        size: chartSize,
      });

      const imgW = 180;
      const imgH = 180;
      const imgX = margin + (contentWidth - imgW) / 2;
      const imgY = cursorY;

      if (pieCanvas) {
        const img = pieCanvas.toDataURL('image/png');
        doc.addImage(img, 'PNG', imgX, imgY, imgW, imgH);
      }

      const legendStartY = imgY + imgH + 16;
      const legendRows = buildLegendRows(slices);

      const colorW = 20;
      const shareW = 70;
      const amountW = 140;
      const categoryW = contentWidth - colorW - amountW - shareW;
      autoTable(doc, {
        startY: legendStartY,
        margin: { left: margin, right: margin },
        tableWidth: contentWidth,
        head: [['', 'Category', 'Amount', 'Share']],
        body: legendRows,
        styles: { 
          font: 'helvetica', 
          fontSize: 9, 
          cellPadding: 7, 
          lineColor: [226, 232, 240],
          lineWidth: 1,
          textColor: [15, 23, 42]
        },
        headStyles: { 
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42], 
          fontStyle: 'bold',
          fontSize: 9
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { cellWidth: colorW },
          1: { cellWidth: categoryW, fontStyle: 'bold' },
          2: { cellWidth: amountW, halign: 'right' },
          3: { cellWidth: shareW, halign: 'right', textColor: [100, 116, 139] },
        },
        didDrawCell: (data) => {
          if (data.section !== 'body') return;
          if (data.column.index !== 0) return;
          const color = data.cell.raw;
          if (typeof color !== 'string') return;
          const hex = color.startsWith('#') ? color : null;
          if (hex && hex.length === 7) {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            doc.setFillColor(r, g, b);
          } else {
            doc.setFillColor(156, 171, 132);
          }
          const pad = 5;
          doc.roundedRect(data.cell.x + pad, data.cell.y + pad, data.cell.width - pad * 2, data.cell.height - pad * 2, 2, 2, 'F');
        },
      });

      cursorY = (doc.lastAutoTable?.finalY || legendStartY) + 24;
    };

    const typeSlices = makeSlices(
      typeBreakdown.map((t) => ({ label: t.name, value: t.value })),
      (it) => typeColorMap[it.label] || SWATCHES[0],
    );
    const partySlices = makeSlices(
      partyRows.map((r, idx) => ({ label: r.party, value: r.total, idx })),
      (it) => SWATCHES[(it.idx ?? 0) % SWATCHES.length],
    );

    drawChartBlock('By Type', typeSlices);
    drawChartBlock('By Party', partySlices);

    const partyType = computePartyTypeBreakdowns();
    parties.forEach((party) => {
      const typeMap = partyType[party] || {};
      const slices = makeSlices(
        Object.entries(typeMap).map(([label, value]) => ({ label, value })),
        (it) => typeColorMap[it.label] || SWATCHES[0],
      );
      drawChartBlock(`${party} — By Type`, slices);
    });

    // Expenses table (new page for readability)
    doc.addPage();
    
    // Section header with minimal accent
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, margin, contentWidth, 36, 6, 6, 'F');
    doc.setFillColor(137, 152, 109); // #89986D
    doc.roundedRect(margin, margin, 4, 36, 2, 2, 'F');
    
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Detailed Expenses', margin + 16, margin + 23);

    const expenseRows = expenses.map((exp, idx) => {
      const splitPartiesStr = exp.paidBy === 'Split Between'
        ? (Array.isArray(exp.splitParties) ? exp.splitParties.join(', ') : '')
        : '';
      return [
        String(idx + 1),
        exp.name || '-',
        exp.type || '-',
        formatINRForPdf(parseAmount(exp.cost)),
        exp.paidBy || '-',
        splitPartiesStr,
      ];
    });

    const expNumW = 28;
    const expCostW = 90;
    const expTypeW = 85;
    const expPaidW = 90;
    const expSplitW = 120;
    const expNameW = contentWidth - expNumW - expTypeW - expCostW - expPaidW - expSplitW;
    autoTable(doc, {
      startY: margin + 46,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      head: [['#', 'Expense', 'Type', 'Cost', 'Paid By', 'Split Parties']],
      body: expenseRows,
      styles: { 
        font: 'helvetica', 
        fontSize: 9, 
        cellPadding: 7, 
        lineColor: [226, 232, 240],
        lineWidth: 1, 
        overflow: 'linebreak',
        textColor: [15, 23, 42]
      },
      headStyles: { 
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42], 
        fontStyle: 'bold',
        fontSize: 9
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: expNumW, halign: 'right', textColor: [100, 116, 139] },
        1: { cellWidth: expNameW, fontStyle: 'bold' },
        2: { cellWidth: expTypeW },
        3: { cellWidth: expCostW, halign: 'right', fontStyle: 'bold' },
        4: { cellWidth: expPaidW },
        5: { cellWidth: expSplitW, fontSize: 8, textColor: [100, 116, 139] },
      },
    });

    const fileSafe = (sheetName || 'sheet').replace(/[^a-z0-9\-_ ]/gi, '').trim() || 'sheet';
    doc.save(`${fileSafe}-report.pdf`);
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

  const typeColorMap = useMemo(
    () => buildTypeColorMap(typeBreakdown.map((t) => t.name)),
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
            onClick={() => setIsExportingPDF(true)}
            variant="outlined"
            startIcon={<PictureAsPdfIcon />}
            disabled={isExportingPDF}
          >
            {isExportingPDF ? 'Generating...' : 'Export PDF'}
          </Button>
          <Button
            onClick={() => setIsExportingExcel(true)}
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
                key={`${p}-${idx}`}
                value={p}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraftParties((prev) => prev.map((x, i) => (i === idx ? v : x)));
                }}
                size="small"
                fullWidth
              />
            ))}
          </Box>

          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1, fontWeight: 700, color: 'text.secondary' }}>
            Expense types
          </Typography>
          <Box sx={{ display: 'grid', gap: 1 }}>
            {draftExpenseTypes.map((t, idx) => (
              <TextField
                key={`${t}-${idx}`}
                value={t}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraftExpenseTypes((prev) => prev.map((x, i) => (i === idx ? v : x)));
                }}
                size="small"
                fullWidth
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

      {/* Lazy-loaded PDF Export */}
      {isExportingPDF && (
        <Suspense fallback={null}>
          <PDFExporter>
            {({ generatePDF }) => {
              generatePDF(sheetName, expenses, parties, partyTotals, typeBreakdown, totalExpenses);
              setIsExportingPDF(false);
              return null;
            }}
          </PDFExporter>
        </Suspense>
      )}

      {/* Lazy-loaded Excel Export */}
      {isExportingExcel && (
        <Suspense fallback={null}>
          <ExcelExporter>
            {({ generateExcel }) => {
              generateExcel(sheetName, expenses, parties, partyTotals, typeBreakdown, totalExpenses);
              setIsExportingExcel(false);
              return null;
            }}
          </ExcelExporter>
        </Suspense>
      )}
    </div>
  );
}

export default ExpenseSheet;
