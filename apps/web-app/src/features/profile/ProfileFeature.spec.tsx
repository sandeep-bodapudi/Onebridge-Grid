// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import type { MyProfile } from '@onebridge/api-contracts';
import { ProfileFeature, MEMBER_NOTICE_VERSION } from './ProfileFeature';
import { apiClient } from '../../api-client';

const profile = (overrides: Partial<MyProfile> = {}): MyProfile => ({
  personId: 'p1',
  handle: 'meera-iyer',
  name: 'Meera Iyer',
  headline: 'Sales executive',
  city: 'Hyderabad',
  skills: ['Sales'],
  languages: [],
  visibility: 'members',
  indexable: false,
  workHistory: [
    { id: 'w1', source: 'seat', verified: true, companyName: 'Sahyadri Steel Works', title: 'Sales executive', startDate: '2026-03-01', hidden: false },
    { id: 'w2', source: 'self', verified: false, companyName: 'Previous Traders', title: 'Intern', startDate: '2022-06-01', endDate: '2023-05-31', hidden: false },
  ],
  completeness: { done: 3, missing: ['photo', 'about'] },
  ...overrides,
});

describe('ProfileFeature (N01)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('creates a profile only with age confirmation and the notice accepted', async () => {
    vi.spyOn(apiClient, 'getMyProfile').mockRejectedValue(Object.assign(new Error('missing'), { code: 'profile_missing' }));
    const save = vi.spyOn(apiClient, 'saveMyProfile').mockResolvedValue(profile());
    render(<ProfileFeature suggestedName="Meera Iyer" />);

    await screen.findByTestId('profile-create');
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Meera Iyer');
    fireEvent.click(screen.getByRole('button', { name: 'Create profile' }));
    expect(screen.getByRole('alert').textContent).toContain('18 or older');
    fireEvent.click(screen.getByLabelText('I am 18 or older.'));
    fireEvent.click(screen.getByRole('button', { name: 'Create profile' }));
    expect(screen.getByRole('alert').textContent).toContain('privacy notice');
    expect(save).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('I accept the member privacy notice.'));
    fireEvent.click(screen.getByRole('button', { name: 'Create profile' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Meera Iyer', ageConfirmed: true, noticeVersion: MEMBER_NOTICE_VERSION })));
    expect(await screen.findByTestId('profile-edit')).toBeTruthy();
  });

  it('edits and saves, sending skills as a list and indexing only for everyone', async () => {
    vi.spyOn(apiClient, 'getMyProfile').mockResolvedValue(profile());
    const save = vi.spyOn(apiClient, 'saveMyProfile').mockImplementation(async (u) => profile({ ...(u as Partial<MyProfile>) }));
    render(<ProfileFeature />);
    await screen.findByTestId('profile-edit');

    expect((screen.getByTestId('profile-save') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Skills'), { target: { value: 'Sales, TMT bars ,  ' } });
    // Indexing is disabled while only members can see the profile.
    expect((screen.getByRole('checkbox', { name: /search engines/i }) as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: /Everyone/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /search engines/i }));
    fireEvent.click(screen.getByTestId('profile-save'));

    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][0]).toMatchObject({ skills: ['Sales', 'TMT bars'], visibility: 'everyone', indexable: true });
  });

  it('lets verified roles be hidden but not edited or deleted', async () => {
    vi.spyOn(apiClient, 'getMyProfile').mockResolvedValue(profile());
    const update = vi.spyOn(apiClient, 'updateWorkHistory').mockResolvedValue(profile().workHistory[0]);
    render(<ProfileFeature />);
    await screen.findByTestId('profile-edit');

    expect(screen.queryByRole('button', { name: 'Edit Sales executive' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete Sales executive' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Intern' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hide Sales executive from my profile' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('w1', { hidden: true }));
  });

  it('shows the completeness checklist and has no axe violations', async () => {
    vi.spyOn(apiClient, 'getMyProfile').mockResolvedValue(profile());
    const { container } = render(<ProfileFeature />);
    await screen.findByTestId('profile-edit');
    expect(screen.getByRole('heading', { name: 'Profile 60% complete' })).toBeTruthy();
    expect(screen.getByText('Add a photo')).toBeTruthy();
    expect((await axe(container)).violations).toEqual([]);
  });
});
