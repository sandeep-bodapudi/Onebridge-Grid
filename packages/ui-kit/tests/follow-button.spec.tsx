// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import React from 'react';
import { FollowButton, formatFollowers } from '../src/components/FollowButton';

describe('FollowButton (N04)', () => {
  it('formats follower counts the Indian way', () => {
    expect(formatFollowers(1)).toBe('1 follower');
    expect(formatFollowers(124800)).toBe('1,24,800 followers');
  });

  it('toggles with a pressed state and a clear label', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<FollowButton following={false} followerCount={12} onToggle={onToggle} targetName="Sahyadri Steel Works" />);
    const button = screen.getByRole('button', { name: 'Follow Sahyadri Steel Works' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalled();
    rerender(<FollowButton following followerCount={13} onToggle={onToggle} targetName="Sahyadri Steel Works" />);
    expect(screen.getByRole('button', { name: 'Unfollow Sahyadri Steel Works' }).textContent).toContain('Following');
    expect(screen.getByTestId('follower-count').textContent).toBe('13 followers');
  });

  it('can be a sign-in link on public pages, without axe violations', async () => {
    const { container } = render(<FollowButton following={false} href="/network/in/meera-iyer" targetName="Meera Iyer" />);
    expect(screen.getByRole('link', { name: 'Follow Meera Iyer' }).getAttribute('href')).toBe('/network/in/meera-iyer');
    expect((await axe(container)).violations).toEqual([]);
  });
});
