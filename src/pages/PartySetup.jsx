import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Container, IconButton, Paper, Snackbar, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import { saveSheet, sheetExists } from '../storage/splitMoneyStore';
import SheetDrawer from '../components/SheetDrawer';
import './PartySetup.css';

function PartySetup() {
  const [sheetName, setSheetName] = useState('');
  const [parties, setParties] = useState(['']);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const handleOpenDrawer = () => setDrawerOpen(true);
  const handleCloseDrawer = () => setDrawerOpen(false);
  const handleCloseError = () => setError('');

  const addParty = () => {
    setParties([...parties, '']);
  };

  const updateParty = (index, value) => {
    const newParties = [...parties];
    newParties[index] = value;
    setParties(newParties);
  };

  const removeParty = (index) => {
    if (parties.length > 1) {
      setParties(parties.filter((_, i) => i !== index));
    }
  };

  const handleGo = async () => {
    const trimmedName = sheetName.trim();
    if (!trimmedName) {
      setError('Sheet name is required');
      return;
    }

    const validParties = parties.filter(p => p.trim() !== '');
    if (validParties.length < 2) {
      setError('Please add at least 2 parties');
      return;
    }

    try {
      const exists = await sheetExists(trimmedName);
      if (exists) {
        setError('A sheet with this name already exists');
        return;
      }

      const sheetData = {
        name: trimmedName,
        parties: validParties,
        expenses: [{ id: '1', name: '', cost: '', paidBy: '', type: 'Food' }],
        expenseTypes: ['Food', 'Transport', 'Accommodation', 'Entertainment', 'Shopping', 'Other'],
      };
      await saveSheet(sheetData);
      navigate('/expenses', { state: { sheetName: trimmedName, parties: validParties } });
    } catch (err) {
      setError(err.message || 'Failed to create sheet');
    }
  };

  const handleImport = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.parties && Array.isArray(data.parties)) {
            const importName = data.name || `Imported ${new Date().toLocaleDateString()}`;
            
            // Check for duplicate and generate unique name
            let finalName = importName;
            let counter = 1;
            while (await sheetExists(finalName)) {
              finalName = `${importName} (${counter})`;
              counter++;
            }

            const sheetData = {
              name: finalName,
              parties: data.parties,
              expenses: data.expenses || [],
              expenseTypes: data.expenseTypes || ['Food', 'Transport', 'Accommodation', 'Entertainment', 'Shopping', 'Other'],
            };
            await saveSheet(sheetData);
            navigate('/expenses', { state: { sheetName: finalName, parties: data.parties, expenses: data.expenses, expenseTypes: data.expenseTypes } });
          } else {
            setError('Invalid file format');
          }
        } catch (err) {
          setError('Invalid file format');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <Box className="party-setup">
      <Container maxWidth="sm">
        <Paper className="setup-container" elevation={0}>
          <Box className="header">
            <Box className="title-row">
              <GroupsOutlinedIcon sx={{ color: 'var(--color-primary)' }} />
              <Typography variant="h2" component="h1">Split Money</Typography>
            </Box>
            <Typography className="subtitle">Add parties to start tracking expenses</Typography>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                onClick={handleOpenDrawer}
                variant="outlined"
                startIcon={<FolderOpenOutlinedIcon />}
                sx={{ borderRadius: 0, borderColor: 'var(--color-primary)', color: 'var(--color-ink)' }}
              >
                Sheets
              </Button>
            </Box>
          </Box>

          <Box className="party-form">
            <TextField
              label="Sheet Name"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              placeholder="e.g. Trip to Goa"
              variant="outlined"
              fullWidth
              required
              sx={{ mb: 3 }}
              InputProps={{
                sx: {
                  borderRadius: 0,
                  backgroundColor: 'var(--color-secondary)',
                },
              }}
            />

            <Typography variant="subtitle2" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-gray-500)' }}>
              Parties
            </Typography>
            <Stack className="party-list" spacing={2}>
              {parties.map((party, index) => (
                <Box key={index} className="party-input-row">
                  <TextField
                    value={party}
                    onChange={(e) => updateParty(index, e.target.value)}
                    placeholder={`Party ${index + 1}`}
                    variant="outlined"
                    fullWidth
                    size="medium"
                    InputProps={{
                      sx: {
                        borderRadius: 0,
                        backgroundColor: 'var(--color-secondary)',
                      },
                    }}
                  />
                  {parties.length > 1 && (
                    <IconButton
                      onClick={() => removeParty(index)}
                      aria-label="Remove party"
                      sx={{
                        border: 'var(--border-width) solid var(--color-primary)',
                        borderRadius: 0,
                        color: 'var(--color-ink)',
                        width: 48,
                        height: 48,
                      }}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  )}
                </Box>
              ))}
            </Stack>

            <Button
              onClick={addParty}
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
              Add Party
            </Button>
          </Box>

          <Stack className="actions" spacing={2}>
            <Button
              onClick={handleGo}
              variant="contained"
              sx={{
                borderRadius: 0,
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-secondary)',
                '&:hover': { backgroundColor: 'var(--color-primary)' },
                py: 1.5,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Go
            </Button>

            <Box className="import-section">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                style={{ display: 'none' }}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outlined"
                startIcon={<UploadFileIcon />}
                fullWidth
                sx={{
                  borderRadius: 0,
                  borderColor: 'var(--color-primary)',
                  color: 'var(--color-ink)',
                }}
              >
                Import Data
              </Button>
            </Box>
          </Stack>
        </Paper>
      </Container>

      <SheetDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        currentSheetName={sheetName || null}
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
    </Box>
  );
}

export default PartySetup;
