import React, { useState } from 'react';
import { ImportAiSongModal } from '../importers/ai-song/ImportAiSongModal';
import { ImportRbsModal } from './ImportRbsModal';
import { AISongData } from '../importers/ai-song/types';
import { RbsSong } from '../importers/rbs/types';

export const MainLayout: React.FC = () => {
  const [showAi, setShowAi] = useState(false);
  const [showRbs, setShowRbs] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const handleAiImport = (data: AISongData) => {
    setToast('AI song imported successfully');
    setShowAi(false);
    // additional handling could go here
  };

  const handleRbsImport = (song: RbsSong) => {
    setToast('RBS file imported successfully');
    setShowRbs(false);
    // additional handling could go here
  };

  return (
    <div className="main-layout">
      <header>
        <button onClick={() => setShowAi(true)}>Import AI Song</button>
        <button onClick={() => setShowRbs(true)}>Import .rbs File...</button>
      </header>
      {toast && <div className="toast">{toast}</div>}
      {showAi && <ImportAiSongModal onImport={handleAiImport} />}
      {showRbs && <ImportRbsModal onImport={handleRbsImport} />}
    </div>
  );
};