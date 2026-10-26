// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import React from 'react';
import { MemberProfileView, MemberProfileData } from '../src/components/MemberProfileView';

const profile: MemberProfileData = {
  handle: 'meera-iyer',
  name: 'Meera Iyer',
  headline: 'Sales executive, structural steel',
  city: 'Hyderabad',
  about: 'Ten years selling steel to builders.',
  skills: ['TMT bars', 'Dealer sales'],
  languages: ['English', 'Hindi', 'Telugu'],
  workHistory: [
    { id: 'w1', verified: true, companyName: 'Sahyadri Steel Works', companySlug: 'sahyadri-steel-works', title: 'Sales executive', startDate: '2024-03-01' },
    { id: 'w2', verified: false, companyName: 'Previous Traders', title: 'Sales intern', startDate: '2022-06-01', endDate: '2023-05-31' },
  ],
};

describe('MemberProfileView (N01)', () => {
  it('shows the current role, verified and unverified experience, skills and languages', () => {
    render(<MemberProfileView profile={profile} companyHref={(slug) => `/${slug}`} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Meera Iyer' })).toBeTruthy();
    expect(screen.getByText('Sales executive, Sahyadri Steel Works')).toBeTruthy();
    expect(screen.getByText('Verified by Sahyadri Steel Works')).toBeTruthy();
    expect(screen.getByText('Not verified')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sahyadri Steel Works' }).getAttribute('href')).toBe('/sahyadri-steel-works');
    expect(screen.getByText('TMT bars')).toBeTruthy();
    expect(screen.getByText('English · Hindi · Telugu')).toBeTruthy();
  });

  it('shows an empty experience state', () => {
    render(<MemberProfileView profile={{ ...profile, workHistory: [] }} />);
    expect(screen.getByText('No experience added yet.')).toBeTruthy();
  });

  it('has no contact links and no axe violations', async () => {
    const { container } = render(<MemberProfileView profile={profile} />);
    expect(container.querySelector('a[href^="tel:"], a[href^="mailto:"], a[href*="wa.me"]')).toBeNull();
    expect((await axe(container)).violations).toEqual([]);
  });
});
