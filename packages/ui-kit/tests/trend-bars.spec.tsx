// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import React from 'react';
import { TrendBars } from '../src/components/TrendBars';

const points = Array.from({ length: 14 }, (_, i) => ({
  date: `2026-10-${String(11 + i).padStart(2, '0')}`,
  primary: i === 13 ? 12 : i,
  secondary: Math.floor(i / 3),
}));

describe('TrendBars', () => {
  it('draws one bar per day per series on a round scale that covers the largest value', () => {
    const { container } = render(<TrendBars title="Views per day" primaryLabel="Views" secondaryLabel="Saves" points={points} />);
    expect(container.querySelectorAll('rect')).toHaveLength(28);
    const ticks = Array.from(container.querySelectorAll('text')).map((t) => t.textContent);
    expect(ticks).toContain('15'); // largest value 12 rounds up to 15
    expect(ticks).toContain('0');
  });

  it('summarises the totals for screen readers', () => {
    render(<TrendBars title="Views per day" primaryLabel="Views" secondaryLabel="Saves" points={points} />);
    const total = points.reduce((s, p) => s + p.primary, 0);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain(`${total} views`);
  });

  it('has no axe violations', async () => {
    const { container } = render(<TrendBars title="Views per day" primaryLabel="Views" points={points} />);
    expect((await axe(container)).violations).toEqual([]);
  });
});
