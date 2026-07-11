import React, { useState } from 'react';
import { AISongData } from './types';

interface Props {
    onImport: (data: AISongData) => void;
}

export const ImportAiSongModal: React.FC<Props> = ({ onImport }) => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<AISongData | null>(null);
    const [progress, setProgress] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleFile = (f: File) => {
        setFile(f);
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const json = JSON.parse(reader.result as string);
                setPreview(json);
                setError(null);
            } catch (e) {
                setError('Invalid JSON');
                setPreview(null);
            }
        };
        reader.readAsText(f);
    };

    const handleUpload = async () => {
        if (!file) return;
        setProgress(0);
        const text = await file.text();
        setProgress(33);
        try {
            const data = JSON.parse(text);
            setProgress(66);
            if (!data || !data.tracks) throw new Error('Bad format');
            setProgress(100);
            onImport(data);
        } catch (e: any) {
            setError(e.message);
        }
    };

    const loadExample = () => {
        const example: AISongData = {
            title: 'Example',
            author: 'AI',
            tempo: 120,
            tracks: [],
        };
        setPreview(example);
    };

    return (
        <div
            className="modal"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
        >
            <h2>Import AI Song</h2>
            {error && <div className="error">{error}</div>}
            <input
                type="file"
                accept=".json"
                onChange={(e) => e.target.files && handleFile(e.target.files[0])}
            />
            <button onClick={handleUpload} disabled={!file}>
                Import
            </button>
            <button onClick={loadExample}>Load Example Song</button>
            <div className="progress-bar" style={{ width: `${progress}%` }}>
                {progress}%
            </div>
            {preview && (
                <div className="preview-pane">
                    <pre>{JSON.stringify(preview, null, 2)}</pre>
                </div>
            )}
        </div>
    );
};