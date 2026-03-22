import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EffectsChain } from '../sequencer/EffectsChain';

describe('EffectsChain', () => {
  it('renders list of effects and toggles active', () => {
    const onPlay = jest.fn();
    render(<EffectsChain onPlay={onPlay} />);

    expect(screen.getByText(/Effects Chain/)).toBeInTheDocument();
    const startBtn = screen.getByText(/Start/);
    fireEvent.click(startBtn);
    expect(screen.getByText(/Stop/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Play Note/));
    expect(onPlay).toHaveBeenCalled();
  });
});