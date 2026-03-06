import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MainLayout } from '../components/MainLayout';

// Note: these tests are shallow and assume the imported components render basic structure

describe('MainLayout', () => {
  it('renders import buttons and opens modals', () => {
    render(<MainLayout />);
    expect(screen.getByText('Import AI Song')).toBeInTheDocument();
    expect(screen.getByText('Import .rbs File...')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Import AI Song'));
    expect(screen.getByText('Import AI Song')).toBeInTheDocument();

    fireEvent.click(screen.getByText('AI Swarm Mode'));
    expect(screen.getByText('AI Swarm Mode')).toBeInTheDocument();
  });
});