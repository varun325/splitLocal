import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { listSheets, loadSheet } from '../storage/splitMoneyStore';
import {
  CREATE_SHEET_TEXT,
  DRAWER_BORDER_COLOR,
  NO_SHEETS_TEXT,
  SHEET_DRAWER_TITLE,
  SHEET_DRAWER_WIDTH,
} from '../constants/sheetDrawer';

export default function SheetDrawer({ open, onClose, currentSheetName }) {
  const [sheets, setSheets] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      listSheets().then(setSheets).catch(() => setSheets([]));
    }
  }, [open]);

  const openSheet = useCallback(async (name) => {
    try {
      const sheet = await loadSheet(name);
      if (sheet) {
        navigate('/expenses', { state: { sheetName: sheet.name, parties: sheet.parties, expenses: sheet.expenses, expenseTypes: sheet.expenseTypes } });
        onClose();
      }
    } catch {
      // ignore
    }
  }, [navigate, onClose]);

  const createNew = useCallback(() => {
    navigate('/');
    onClose();
  }, [navigate, onClose]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: SHEET_DRAWER_WIDTH,
        },
      }}
    >
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: DRAWER_BORDER_COLOR,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {SHEET_DRAWER_TITLE}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      <List sx={{ flex: 1, overflow: 'auto' }}>
        {sheets.length === 0 && (
          <ListItem>
            <ListItemText secondary={NO_SHEETS_TEXT} />
          </ListItem>
        )}
        {sheets.map((name) => (
          <ListItemButton
            key={name}
            selected={name === currentSheetName}
            onClick={() => openSheet(name)}
            sx={{ 
              borderRadius: 2,
              mx: 1,
              my: 0.5,
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <DescriptionOutlinedIcon />
            </ListItemIcon>
            <ListItemText
              primary={name}
              primaryTypographyProps={{
                sx: {
                  fontWeight: name === currentSheetName ? 600 : 400,
                },
              }}
            />
          </ListItemButton>
        ))}
      </List>

      <Divider />
      <Box sx={{ p: 2 }}>
        <ListItemButton 
          onClick={createNew} 
          sx={{ 
            borderRadius: 2, 
            border: '2px dashed',
            borderColor: 'divider',
          }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <AddIcon />
          </ListItemIcon>
          <ListItemText primary={CREATE_SHEET_TEXT} />
        </ListItemButton>
      </Box>
    </Drawer>
  );
}
