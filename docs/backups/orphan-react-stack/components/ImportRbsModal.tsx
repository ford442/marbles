import React, { useState } from 'react';
import { RbsSong } from '../importers/rbs/types';

interface Props {
    onImport: (song: RbsSong) => void;
}

export const ImportRbsModal: React.FC<Props> = ({ onImport }) => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
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
                const arr = new Uint8Array(reader.result as ArrayBuffer);
                const hex = Array.from(arr.slice(0, 16))
                    .map((b) => b.toString(16).padStart(2, '0'))
                    .join(' ');
                setPreview(hex);
                setError(null);
            } catch (e) {
                setError('Cannot preview file');
                setPreview(null);
            }
        };
        reader.readAsArrayBuffer(f);
    };

    const handleUpload = async () => {
        if (!file) return;
        setProgress(0);
        // we don't actually parse in browser, just simulate success
        setTimeout(() => {
            setProgress(100);
            onImport({ title: file.name, tempo: 0, tracks: [] });
        }, 200);
    };

    return (
        <div
            className="modal"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
        >
            <h2>Import RBS File</h2>
            {error && <div className="error">{error}</div>}
            <input
                type="file"
                accept=".rbs"
                onChange={(e) => e.target.files && handleFile(e.target.files[0])}
            />
            <button onClick={handleUpload} disabled={!file}>
                Import
            </button>
            <div className="progress-bar" style={{ width: `${progress}%` }}>
                {progress}%
            </div>
            {preview && (
                <div className="preview-pane">
                    <small>first 16 bytes:</small>
                    <pre>{preview}</pre>
                </div>
            )}
        </div>
    );
};