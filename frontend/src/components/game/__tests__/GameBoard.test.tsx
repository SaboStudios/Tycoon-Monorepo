import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import GameBoard from '../GameBoard';

describe('GameBoard', () => {
  it('renders the game board grid', () => {
    render(<GameBoard />);
    const board = screen.getByRole('grid', { name: /game board/i });
    expect(board).toBeDefined();
  });

  it('has 40 track squares', () => {
    render(<GameBoard />);
    const squares = screen.getAllByRole('gridcell');
    expect(squares).toHaveLength(40);
  });

  it('board is focusable', () => {
    render(<GameBoard />);
    const board = screen.getByRole('grid', { name: /game board/i });
    expect(board).toHaveAttribute('tabIndex', '0');
  });

  it('focuses first square on board focus', () => {
    render(<GameBoard />);
    const board = screen.getByRole('grid', { name: /game board/i });
    fireEvent.focus(board);
    const goSquare = screen.getByRole('gridcell', { name: /GO square/i });
    expect(goSquare).toHaveAttribute('tabIndex', '0');
  });

  it('navigates squares with arrow keys', () => {
    render(<GameBoard />);
    const board = screen.getByRole('grid', { name: /game board/i });
    fireEvent.focus(board);
    
    // Focus should be on GO
    let focusedSquare = screen.getByRole('gridcell', { name: /GO square/i });
    expect(focusedSquare).toHaveAttribute('tabIndex', '0');
    
    // Press right arrow
    fireEvent.keyDown(board, { key: 'ArrowRight' });
    focusedSquare = screen.getByRole('gridcell', { name: /Mediterranean square/i });
    expect(focusedSquare).toHaveAttribute('tabIndex', '0');
  });

  it('opens inventory overlay with keyboard shortcut', () => {
    render(<GameBoard />);
    fireEvent.keyDown(document, { key: 'i' });
    expect(screen.getByRole('dialog', { name: /inventory/i })).toBeDefined();
  });

  it('closes overlay and returns focus to board', () => {
    render(<GameBoard />);
    fireEvent.keyDown(document, { key: 'i' });
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    const board = screen.getByRole('grid', { name: /game board/i });
    expect(board).toHaveFocus();
  });
});