// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import React from 'react';
import { ActionButton } from '../src/components/ActionButton';
import { StatusChip, OfflineBanner, StatTile } from '../src/components/index';

expect.extend(toHaveNoViolations);

describe('UI Kit Components', () => {
  it('ActionButton should not have basic accessibility violations and matches snapshot', async () => {
    const { container } = render(<ActionButton>Click me</ActionButton>);
    const results = await axe(container);
    // @ts-expect-error - jest-axe types do not extend vitest Assertion globally without conflicts
    expect(results).toHaveNoViolations();
    expect(container).toMatchSnapshot();
  });

  it('StatusChip should not have basic accessibility violations and matches snapshot', async () => {
    const { container } = render(<StatusChip status="success">Active</StatusChip>);
    const results = await axe(container);
    // @ts-expect-error - jest-axe types do not extend vitest Assertion globally without conflicts
    expect(results).toHaveNoViolations();
    expect(container).toMatchSnapshot();
  });

  it('OfflineBanner should display correct text', () => {
    const { getByText } = render(<OfflineBanner message="You are offline" />);
    expect(getByText('You are offline')).toBeTruthy();
  });

  it('StatTile should render label and value and match snapshot', () => {
    const { getByText, container } = render(<StatTile label="Total Views" value="1,234" />);
    expect(getByText('Total Views')).toBeTruthy();
    expect(getByText('1,234')).toBeTruthy();
    expect(container).toMatchSnapshot();
  });

  it('ActionButton disabled state applies opacity', () => {
    const { container } = render(<ActionButton disabled>Disabled</ActionButton>);
    expect(container.firstChild).toHaveProperty('disabled', true);
    // tailwind-merge generated class check
    expect((container.firstChild as HTMLElement).className).toContain('disabled:opacity-50');
  });
});
