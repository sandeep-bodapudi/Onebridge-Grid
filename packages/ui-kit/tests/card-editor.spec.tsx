// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import React from 'react';
import { CardEditor, CardEditorCard, CardEditorSection } from '../src/components/CardEditor';

const SECTION_TYPES = [
  'about',
  'products',
  'services',
  'portfolio',
  'gallery',
  'documents',
  'social_links',
  'company_info',
  'branch_map',
] as const;

function makeCard(overrides: Partial<CardEditorCard> = {}, aboutPatch: Partial<CardEditorSection> = {}): CardEditorCard {
  return {
    id: 'OB-ABC123-E0001',
    slug: 'acme/ob-abc123-e0001',
    templateId: 'classic-charcoal',
    status: 'draft',
    approvalRequired: false,
    sections: SECTION_TYPES.map((type, order) => ({
      type,
      enabled: true,
      order,
      locked: false,
      visibility: 'public' as const,
      content: type === 'about' ? { name: 'Sneha Reddy', designation: 'Sales lead' } : {},
      ...(type === 'about' ? aboutPatch : {}),
    })),
    ...overrides,
  };
}

const templates = [
  { id: 'classic-charcoal', name: 'Classic Charcoal', description: 'Brand colour band' },
  { id: 'bridge-orange', name: 'Bridge Orange', description: 'Orange band' },
];

describe('F10: CardEditor', () => {
  it('shows the card details, templates and all 9 sections', () => {
    render(<CardEditor card={makeCard()} templates={templates} isAdmin onSave={vi.fn()} onPublish={vi.fn()} />);
    expect((screen.getByTestId('card-field-name') as HTMLInputElement).value).toBe('Sneha Reddy');
    expect(screen.getAllByTestId(/^template-/)).toHaveLength(2);
    expect(screen.getAllByTestId(/^section-row-/)).toHaveLength(9);
    expect(screen.getByTestId('card-status').textContent).toContain('Draft');
  });

  it('keeps Save disabled until something changes, then sends template and details', () => {
    const onSave = vi.fn();
    render(<CardEditor card={makeCard()} templates={templates} isAdmin onSave={onSave} onPublish={vi.fn()} />);
    const save = screen.getByTestId('card-save') as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.change(screen.getByTestId('card-field-phone'), { target: { value: '98765 43210' } });
    fireEvent.click(screen.getByTestId('template-bridge-orange'));
    expect(save.disabled).toBe(false);
    fireEvent.click(save);

    const update = onSave.mock.calls[0][0];
    expect(update.templateId).toBe('bridge-orange');
    expect(update.sections.find((s: CardEditorSection) => s.type === 'about').content.phone).toBe('98765 43210');
  });

  it('disables publishing while there are unsaved changes', () => {
    render(<CardEditor card={makeCard()} templates={templates} isAdmin onSave={vi.fn()} onPublish={vi.fn()} />);
    fireEvent.change(screen.getByTestId('card-field-name'), { target: { value: 'Changed' } });
    expect((screen.getByTestId('card-publish') as HTMLButtonElement).disabled).toBe(true);
  });

  it('locks details and section controls for employees when the company locked them', () => {
    render(
      <CardEditor card={makeCard({}, { locked: true })} templates={templates} isAdmin={false} onSave={vi.fn()} onPublish={vi.fn()} />
    );
    expect((screen.getByTestId('card-field-name') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('section-enabled-about') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByTestId('section-locked-about')).toBeNull(); // only admins see lock toggles
    expect(screen.getAllByText(/locked this/i).length).toBeGreaterThan(0);
  });

  it('lets admins edit locked sections and toggle locks', () => {
    render(<CardEditor card={makeCard({}, { locked: true })} templates={templates} isAdmin onSave={vi.fn()} onPublish={vi.fn()} />);
    expect((screen.getByTestId('card-field-name') as HTMLInputElement).disabled).toBe(false);
    expect(screen.getByTestId('section-locked-about')).toBeTruthy();
  });

  it('labels publish as "Submit for approval" for employees when approval is required', () => {
    render(
      <CardEditor card={makeCard({ approvalRequired: true })} templates={templates} isAdmin={false} onSave={vi.fn()} onPublish={vi.fn()} />
    );
    expect(screen.getByTestId('card-publish').textContent).toBe('Submit for approval');
  });

  it('shows Approve for admins on a card waiting for approval', () => {
    const onApprove = vi.fn();
    render(
      <CardEditor
        card={makeCard({ status: 'pending_approval' })}
        templates={templates}
        isAdmin
        onSave={vi.fn()}
        onPublish={vi.fn()}
        onApprove={onApprove}
      />
    );
    fireEvent.click(screen.getByTestId('card-approve'));
    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('card-status').textContent).toContain('Waiting for approval');
  });

  it('links to the public card once published', () => {
    render(
      <CardEditor
        card={makeCard({ status: 'published' })}
        templates={templates}
        isAdmin
        publicUrl="https://cards.example/c/acme/x"
        onSave={vi.fn()}
        onPublish={vi.fn()}
      />
    );
    expect(screen.getByTestId('open-public-card').getAttribute('href')).toBe('https://cards.example/c/acme/x');
  });

  it('moves sections up and down', () => {
    const onSave = vi.fn();
    render(<CardEditor card={makeCard()} templates={templates} isAdmin onSave={onSave} onPublish={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Sections' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move down: About' }));
    fireEvent.click(screen.getByTestId('card-save'));
    const order = onSave.mock.calls[0][0].sections.map((s: CardEditorSection) => s.type);
    expect(order.slice(0, 2)).toEqual(['products', 'about']);
  });

  it('renders loading, empty and error states', () => {
    const { rerender } = render(
      <CardEditor card={null} templates={templates} isAdmin isLoading onSave={vi.fn()} onPublish={vi.fn()} />
    );
    expect(screen.getByTestId('card-editor-loading')).toBeTruthy();
    rerender(<CardEditor card={null} templates={templates} isAdmin onSave={vi.fn()} onPublish={vi.fn()} />);
    expect(screen.getByTestId('card-editor-empty')).toBeTruthy();
    rerender(<CardEditor card={makeCard()} templates={templates} isAdmin error="Could not save the card" onSave={vi.fn()} onPublish={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toBe('Could not save the card');
  });

  it('validates details on blur and keeps Save from sending invalid data', () => {
    const onSave = vi.fn();
    render(<CardEditor card={makeCard()} templates={templates} isAdmin onSave={onSave} onPublish={vi.fn()} />);
    const phone = screen.getByTestId('card-field-phone');
    fireEvent.change(phone, { target: { value: '123' } });
    fireEvent.blur(phone);
    expect(screen.getByText(/10-digit indian mobile number/i)).toBeTruthy();
    fireEvent.click(screen.getByTestId('card-save'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('makes Save the main action once a card is published (no second publish step)', () => {
    render(
      <CardEditor card={makeCard({ status: 'published' })} templates={templates} isAdmin onSave={vi.fn()} onPublish={vi.fn()} />
    );
    expect(screen.queryByTestId('card-publish')).toBeNull();
    expect(screen.getByTestId('card-save').textContent).toBe('Save changes');
  });

  it('reports each edit for the live preview', () => {
    const onDraftChange = vi.fn();
    render(
      <CardEditor card={makeCard()} templates={templates} isAdmin onSave={vi.fn()} onPublish={vi.fn()} onDraftChange={onDraftChange} />
    );
    fireEvent.change(screen.getByTestId('card-field-designation'), { target: { value: 'Head of sales' } });
    const last = onDraftChange.mock.calls[onDraftChange.mock.calls.length - 1][0];
    expect(last.sections.find((s: CardEditorSection) => s.type === 'about').content.designation).toBe('Head of sales');
  });

  it('has no axe violations', async () => {
    const { container } = render(<CardEditor card={makeCard()} templates={templates} isAdmin onSave={vi.fn()} onPublish={vi.fn()} />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
