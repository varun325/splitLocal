import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PartySetup from './pages/PartySetup';
import ExpenseSheet from './pages/ExpenseSheet';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PartySetup />} />
        <Route path="/expenses" element={<ExpenseSheet />} />
      </Routes>
    </Router>
  );
}

export default App;
