// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import React from 'react';
import { SearchResultsList, SearchResultItem } from '../src/components/SearchResultsList';

const items: SearchResultItem[] = [
  { actor: { type: 'company', id: 'c1', handle: 'charminar-fabricators', name: 'Charminar Fabricators', headline: 'Manufacturing · Hyderabad', verified: true }, city: 'Hyderabad', snippet: 'CNC turned parts', featured: false },
  { actor: { type: 'member', id: 'p1', handle: 'ravi-teja-reddy', name: 'Ravi Teja Reddy', headline: 'Procurement manager', verified: false }, city: 'Hyderabad', featured: true },
];

describe('SearchResultsList (N03)', () => {
  it('links each result, labels verified and featured, and shows the match', () => {
    render(<SearchResultsList items={items} total={2} hrefFor={(i) => (i.actor.type === 'company' ? `/${i.actor.handle}` : `/in/${i.actor.handle}`)} />);
    expect(screen.getByRole('status').textContent).toBe('2 results');
    expect(screen.getByRole('link', { name: /Charminar Fabricators/ }).getAttribute('href')).toBe('/charminar-fabricators');
    expect(screen.getByRole('link', { name: /Ravi Teja Reddy/ }).getAttribute('href')).toBe('/in/ravi-teja-reddy');
    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.getByText('Featured')).toBeTruthy();
    expect(screen.getByText('Matches: CNC turned parts')).toBeTruthy();
  });

  it('shows an empty state with a hint', () => {
    render(<SearchResultsList items={[]} hrefFor={() => '#'} emptyHint="Try fewer words." />);
    expect(screen.getByTestId('search-empty').textContent).toContain('Try fewer words.');
  });

  it('has no axe violations', async () => {
    const { container } = render(<SearchResultsList items={items} total={2} hrefFor={() => '#'} />);
    expect((await axe(container)).violations).toEqual([]);
  });
});
