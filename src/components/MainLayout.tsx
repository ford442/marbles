import React, { useState } from 'react';
import { ImportAiSongModal } from '../importers/ai-song/ImportAiSongModal';
import { ImportRbsModal } from './ImportRbsModal';
import { AISongData } from '../importers/ai-song/types';
import { RbsSong } from '../importers/rbs/types';
import { SequencerGrid } from '../sequencer/SequencerGrid';
import { EffectsChain } from '../sequencer/EffectsChain';
import { AISwarmModal } from './AISwarmModal';

export const MainLayout: React.FC = () => {
    const [showAi, setShowAi] = useState(false);
    const [showRbs, setShowRbs] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [loadedSong, setLoadedSong] = useState<AISongData | null>(null);
    const [showSwarm, setShowSwarm] = useState(false);
    const [swarmStatus, setSwarmStatus] = useState<string | null>(null);

    const handleAiImport = (data: AISongData) => {
        setToast('AI song imported successfully');
        setShowAi(false);
        setLoadedSong(data);
        // additional handling could go here
    };

    const handleRbsImport = (song: RbsSong) => {
        setToast('RBS file imported successfully');
        setShowRbs(false);
        // could convert to AISongData for sequencer
    };

    return (
        <div className="main-layout">
            <header>
                <button onClick={() => setShowAi(true)}>Import AI Song</button>
                <button onClick={() => setShowSwarm(true)}>AI Swarm Mode</button>
                <button onClick={() => setShowRbs(true)}>Import .rbs File...</button>
            </header>
            {toast && <div className="toast">{toast}</div>}
            {showAi && <ImportAiSongModal onImport={handleAiImport} />}
            {showSwarm && <AISwarmModal onClose={() => setShowSwarm(false)} setStatus={setSwarmStatus} />}
            {showRbs && <ImportRbsModal onImport={handleRbsImport} />}
            {loadedSong && (
                <>
                    <SequencerGrid song={loadedSong} />
                    <EffectsChain onPlay={() => console.log('play')} />
                </>
            )}
            {swarmStatus && <div className="swarm-status">{swarmStatus}</div>}
        </div>
    );
};