import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AISwarmModal } from '../components/AISwarmModal';

describe('AISwarmModal', () => {
  it('allows selecting roles and starting swarm', () => {
    const setStatus = jest.fn();
    const onClose = jest.fn();

    render(<AISwarmModal onClose={onClose} setStatus={setStatus} />);

    const roleCheckbox = screen.getByLabelText('Melodist');
    fireEvent.click(roleCheckbox);

    const startBtn = screen.getByText('Start');
    fireEvent.click(startBtn);

    expect(onClose).toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith('Swarm started');
  });
});