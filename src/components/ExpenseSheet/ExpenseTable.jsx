import { memo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button, Box } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { ExpenseRow } from './ExpenseRow';

export const ExpenseTable = memo(function ExpenseTable({
  expenses,
  parties,
  expenseTypes,
  onDragEnd,
  onFieldChange,
  onDelete,
  onAddExpense
}) {
  return (
    <Box>
      <div className="expense-table-header">
        <span style={{ width: '40px' }}></span>
        <span>Description</span>
        <span>Cost (₹)</span>
        <span>Type</span>
        <span>Paid By</span>
        <span style={{ width: '40px' }}></span>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="expenses">
          {(provided) => (
            <div
              className="expense-list"
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              {expenses.map((expense, index) => (
                <Draggable key={expense.id} draggableId={expense.id} index={index}>
                  {(provided) => (
                    <ExpenseRow
                      expense={expense}
                      index={index}
                      parties={parties}
                      expenseTypes={expenseTypes}
                      provided={provided}
                      onFieldChange={onFieldChange}
                      onDelete={onDelete}
                    />
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={onAddExpense}
        fullWidth
        sx={{ mt: 2 }}
      >
        Add Expense
      </Button>
    </Box>
  );
});
