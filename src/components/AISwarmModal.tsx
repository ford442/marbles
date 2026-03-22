import React, { useState } from 'react';

interface Props {
  onClose: () => void;
  setStatus: (status: string | null) => void;
}

const roles = ['Melodist', 'Lyricist', 'Drummer', 'Bassist', 'Harmonist', 'Automation'];
const patterns = ['Sequential', 'Parallel', 'Round-robin'];

export const AISwarmModal: React.FC<Props> = ({ onClose, setStatus }) => {
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [pattern, setPattern] = useState<string>(patterns[0]);

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const startSwarm = () => {
    setStatus('Swarm started');
    let step = 0;
    const interval = setInterval(() => {
      if (step < selectedRoles.length) {
        setStatus(`${selectedRoles[step]} working...`);
      } else {
        setStatus('Swarm complete');
        clearInterval(interval);
      }
      step++;
    }, 1000);
    onClose();
  };

  return (
    <div className="modal">
      <h2>AI Swarm Mode</h2>
      <div className="roles">
        {roles.map((r) => (
          <label key={r}>
            <input
              type="checkbox"
              checked={selectedRoles.includes(r)}
              onChange={() => toggleRole(r)}
            />
            {r}
          </label>
        ))}
      </div>
      <div className="pattern">
        <label>
          Collaboration pattern:
          <select value={pattern} onChange={(e) => setPattern(e.target.value)}>
            {patterns.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button onClick={startSwarm} disabled={selectedRoles.length === 0}>
        Start
      </button>
      <button onClick={onClose}>Cancel</button>
    </div>
  );
};