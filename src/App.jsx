import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import PartySetup from './pages/PartySetup';
import ExpenseSheet from './pages/ExpenseSheet';
import { theme } from './theme';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={<PartySetup />} />
          <Route path="/expenses" element={<ExpenseSheet />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
