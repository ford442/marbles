import React, { useState } from 'react';
import { AISongData } from '../importers/ai-song/types';

interface Props {
    song: AISongData;
}

// simple grid that shows automation lanes as colored bars
export const SequencerGrid: React.FC<Props> = ({ song }) => {
    const [currentTime, setCurrentTime] = useState(0);
    const duration = 16;

    const tick = () => {
        setCurrentTime((t) => (t + 0.1) % duration);
    };

    React.useEffect(() => {
        const id = setInterval(tick, 100);
        return () => clearInterval(id);
    }, []);

    return (
        <div className="sequencer-grid">
            <h3>Sequencer ({song.title})</h3>
            <div className="time-indicator">{currentTime.toFixed(1)}</div>
            {song.tracks.map((tr, ti) => (
                <div key={ti} className="track-row">
                    <span className="instrument">{tr.instrument}</span>
                    {tr.automation && tr.automation.map((lane, li) => (
                        <div key={li} className="automation-lane">
                            <strong>{lane.parameter}</strong>
                            <div className="bars">
                                {lane.points.map((pt, pi) => (
                                    <div
                                        key={pi}
                                        className="bar"
                                        style={{ left: `${(pt.time / duration) * 100}%`, height: `${pt.value * 100}%` }}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};