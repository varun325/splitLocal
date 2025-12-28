import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Upload } from 'lucide-react';
import './PartySetup.css';

function PartySetup() {
  const [parties, setParties] = useState(['']);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

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
    <div className="party-setup">
      <div className="setup-container">
        <div className="header">
          <h1>Split Money</h1>
          <p className="subtitle">Add parties to start tracking expenses</p>
        </div>

        <div className="party-form">
          <div className="party-list">
            {parties.map((party, index) => (
              <div key={index} className="party-input-row">
                <input
                  type="text"
                  value={party}
                  onChange={(e) => updateParty(index, e.target.value)}
                  placeholder={`Party ${index + 1}`}
                  className="party-input"
                />
                {parties.length > 1 && (
                  <button
                    onClick={() => removeParty(index)}
                    className="btn-icon"
                    aria-label="Remove party"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button onClick={addParty} className="btn-add">
            <Plus size={20} />
            <span>Add Party</span>
          </button>
        </div>

        <div className="actions">
          <button onClick={handleGo} className="btn-primary">
            Go
          </button>
          
          <div className="import-section">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary"
            >
              <Upload size={20} />
              <span>Import Data</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PartySetup;
