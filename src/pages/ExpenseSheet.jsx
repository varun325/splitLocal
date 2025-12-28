import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Download, GripVertical, Trash2, Plus } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import * as XLSX from 'xlsx';
import './ExpenseSheet.css';

const EXPENSE_TYPES = ['Food', 'Transport', 'Accommodation', 'Entertainment', 'Shopping', 'Other'];
const COLORS = ['#000000', '#3c3c3c', '#6e6e6e', '#a0a0a0', '#d1d1d1', '#e8e8e8'];

const formatINR = (amount) => {
  const value = Number(amount) || 0;
  return value.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
};

function ExpenseSheet() {
  const location = useLocation();
  const navigate = useNavigate();
  const { parties = [], expenses: importedExpenses = [] } = location.state || {};

  const [expenses, setExpenses] = useState(importedExpenses.length > 0 ? importedExpenses : [
    { id: '1', name: '', cost: '', paidBy: '', type: 'Food' }
  ]);

  useEffect(() => {
    if (!parties || parties.length === 0) {
      navigate('/');
    }
  }, [parties, navigate]);

  const addExpense = () => {
    setExpenses([...expenses, {
      id: Date.now().toString(),
      name: '',
      cost: '',
      paidBy: '',
      type: 'Food'
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
      expenses
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
  const totalExpenses = expenses.reduce((sum, exp) => sum + (parseFloat(exp.cost) || 0), 0);

  if (!parties || parties.length === 0) {
    return null;
  }

  return (
    <div className="expense-sheet">
      <div className="sheet-header">
        <div>
          <h1>Expense Tracker</h1>
          <p className="subtitle">{parties.length} parties tracking expenses</p>
        </div>
        <div className="header-actions">
          <button onClick={exportToExcel} className="btn-export">
            <Download size={18} />
            <span>Export Excel</span>
          </button>
          <button onClick={exportToJSON} className="btn-export">
            <Download size={18} />
            <span>Save Data</span>
          </button>
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
                            <GripVertical size={18} />
                          </div>
                          <div className="col-name">
                            <input
                              type="text"
                              value={expense.name}
                              onChange={(e) => updateExpense(expense.id, 'name', e.target.value)}
                              placeholder="Enter expense name"
                            />
                          </div>
                          <div className="col-cost">
                            <input
                              type="number"
                              value={expense.cost}
                              onChange={(e) => updateExpense(expense.id, 'cost', e.target.value)}
                              placeholder="0.00"
                              step="0.01"
                            />
                          </div>
                          <div className="col-paidby">
                            <select
                              value={expense.paidBy}
                              onChange={(e) => updateExpense(expense.id, 'paidBy', e.target.value)}
                            >
                              <option value="">Select...</option>
                              <option value="Split Equally">Split Equally</option>
                              {parties.map(party => (
                                <option key={party} value={party}>{party}</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-type">
                            <select
                              value={expense.type}
                              onChange={(e) => updateExpense(expense.id, 'type', e.target.value)}
                            >
                              {EXPENSE_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-actions">
                            <button
                              onClick={() => removeExpense(expense.id)}
                              className="btn-delete"
                              disabled={expenses.length === 1}
                            >
                              <Trash2 size={16} />
                            </button>
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

          <button onClick={addExpense} className="btn-add-expense">
            <Plus size={18} />
            <span>Add Expense</span>
          </button>
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
                    label={(entry) => `${entry.name}: ${formatINR(entry.value)}`}
                  >
                    {typeBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatINR(value)} />
                </PieChart>
              </ResponsiveContainer>
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
