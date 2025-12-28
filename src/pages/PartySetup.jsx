import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, IconButton, Paper, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { loadAppData, patchAppData } from '../storage/splitMoneyStore';
import './PartySetup.css';

function PartySetup() {
  const [parties, setParties] = useState(['']);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await loadAppData();
        if (cancelled || !saved) return;
        if (Array.isArray(saved.parties) && saved.parties.length > 0) {
          setParties(saved.parties);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const valid = parties.map((p) => p.trim()).filter(Boolean);
    const t = setTimeout(() => {
      patchAppData({ parties: valid.length > 0 ? valid : [] }).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [parties]);

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

  const handleGo = () => {
    const validParties = parties.filter(p => p.trim() !== '');
    if (validParties.length >= 2) {
      patchAppData({ parties: validParties }).catch(() => {});
      navigate('/expenses', { state: { parties: validParties } });
    } else {
      alert('Please add at least 2 parties');
    }
  };

  const handleImport = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.parties && Array.isArray(data.parties)) {
            navigate('/expenses', { state: data });
          }
        } catch (error) {
          alert('Invalid file format');
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
          </Box>

          <Box className="party-form">
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
    </Box>
  );
}

export default PartySetup;
