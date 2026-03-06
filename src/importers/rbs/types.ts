export interface Slide {
  start: number;
  end: number;
  from: number;
  to: number;
}

export interface Accent {
  step: number;
  value: number;
}

export interface AutomationPoint {
  time: number;
  value: number;
}

export interface AutomationLane {
  parameter: string;
  points: AutomationPoint[];
}

export interface PCFSettings {
  cutoff: number;
  resonance: number;
  envMod: number;
}

export interface RbsPattern {
  steps: number[];
  slides?: Slide[];
  accents?: Accent[];
  automation?: AutomationLane[];
}

export interface RbsTrack {
  instrument: string;
  patterns: RbsPattern[];
}

export interface RbsSong {
  title: string;
  tempo: number;
  tracks: RbsTrack[];
  metadata?: Record<string, string>;
}