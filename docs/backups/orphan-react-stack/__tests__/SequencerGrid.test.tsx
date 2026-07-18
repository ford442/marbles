import React from 'react';
import { render, screen } from '@testing-library/react';
import { SequencerGrid } from '../sequencer/SequencerGrid';
import { AISongData } from '../importers/ai-song/types';

describe('SequencerGrid', () => {
  it('renders title and tracks', () => {
    const song: AISongData = {
      title: 'Test',
      author: 'AI',
      tempo: 120,
      tracks: [
        {
          instrument: 'lead',
          automation: [
            { parameter: 'cutoff', points: [{ time: 0, value: 0.5 }] },
          ],
        },
      ],
    };
    render(<SequencerGrid song={song} />);
    expect(screen.getByText(/Test/)).toBeInTheDocument();
    expect(screen.getByText(/lead/)).toBeInTheDocument();
    expect(screen.getByText(/cutoff/)).toBeInTheDocument();
  });
});