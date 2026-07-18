export interface AutomationPoint {
    time: number;
    value: number;
}

export interface AutomationLane {
    parameter: string;
    points: AutomationPoint[];
}

export interface Track {
    instrument: string;
    notes?: any[]; // can be expanded in future
    automation?: AutomationLane[];
}

export interface AISongData {
    title: string;
    author: string;
    tempo: number;
    tracks: Track[]; // each track may include automated parameters
    metadata?: Record<string, string>;
}

export interface VersionHistoryEntry {
    timestamp: string;
    sourceAI: string;
    notes?: string;
}