import { useEffect, useState } from 'react';
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

export default function SheetDrawer({ open, onClose, currentSheetName }) {
  const [sheets, setSheets] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      listSheets().then(setSheets).catch(() => setSheets([]));
    }
  }, [open]);

  const openSheet = async (name) => {
    try {
      const sheet = await loadSheet(name);
      if (sheet) {
        navigate('/expenses', { state: { sheetName: sheet.name, parties: sheet.parties, expenses: sheet.expenses, expenseTypes: sheet.expenseTypes } });
        onClose();
      }
    } catch {
      // ignore
    }
  };

  const createNew = () => {
    navigate('/');
    onClose();
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 320,
        },
      }}
    >
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '2px solid var(--color-gray-100)',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Sheets
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      <List sx={{ flex: 1, overflow: 'auto' }}>
        {sheets.length === 0 && (
          <ListItem>
            <ListItemText secondary="No sheets yet" />
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
          <ListItemText primary="Create new sheet" />
        </ListItemButton>
      </Box>
    </Drawer>
  );
}
