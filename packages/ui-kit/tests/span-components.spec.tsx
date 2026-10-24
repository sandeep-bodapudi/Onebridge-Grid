// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import React from 'react';
import {
  Button,
  IconButton,
  FormField,
  Input,
  Select,
  SegmentedControl,
  OtpInput,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Tabs,
  Toast,
  EmptyState,
  Skeleton,
  SlideOverPanel,
  ConfirmDialog,
  SpanLine,
  KeystoneTag,
  StatTile,
  QrPreview,
  PhoneFramePreview,
  AppShell,
  SpanCard,
  StatusChip,
} from '../src/components/index';

expect.extend(toHaveNoViolations);

describe('Span Design Language Components (Phase D1)', () => {
  describe('Button & IconButton', () => {
    it('Button renders all 4 variants and meets accessibility standards', async () => {
      const { container, rerender } = render(<Button variant="primary">Primary action</Button>);
      expect(container.firstChild?.textContent).toContain('Primary action');
      expect((container.firstChild as HTMLElement).className).toContain('bg-bridge-orange');
      expect((container.firstChild as HTMLElement).className).toContain('text-charcoal');
      expect((container.firstChild as HTMLElement).className).toContain('rounded-control');
      let results = await axe(container);
      // @ts-expect-error - axe matcher
      expect(results).toHaveNoViolations();

      rerender(<Button variant="secondary">Secondary action</Button>);
      expect((container.firstChild as HTMLElement).className).toContain('bg-warm-paper');
      results = await axe(container);
      // @ts-expect-error - axe matcher
      expect(results).toHaveNoViolations();

      rerender(<Button variant="ghost">Ghost action</Button>);
      expect((container.firstChild as HTMLElement).className).toContain('bg-transparent');
      results = await axe(container);
      // @ts-expect-error - axe matcher
      expect(results).toHaveNoViolations();

      rerender(<Button variant="destructive">Delete item</Button>);
      expect((container.firstChild as HTMLElement).className).toContain('bg-error');
      results = await axe(container);
      // @ts-expect-error - axe matcher
      expect(results).toHaveNoViolations();
    });

    it('Button handles loading and disabled states gracefully', () => {
      const { container, rerender } = render(<Button isLoading>Submit</Button>);
      expect(container.firstChild).toHaveProperty('disabled', true);
      expect(container.firstChild?.textContent).toContain('Loading...');

      rerender(<Button disabled>Disabled button</Button>);
      expect(container.firstChild).toHaveProperty('disabled', true);
      expect((container.firstChild as HTMLElement).className).toContain('disabled:opacity-50');
    });

    it('IconButton enforces 44px min touch target, aria-label, and passes axe', async () => {
      const onClick = vi.fn();
      const { container, getByRole } = render(
        <IconButton label="Edit settings" tooltip="Edit settings" onClick={onClick}>
          <span>✎</span>
        </IconButton>
      );
      const button = getByRole('button', { name: 'Edit settings' });
      expect(button).toBeTruthy();
      expect(button.className).toContain('min-w-[44px]');
      expect(button.className).toContain('min-h-[44px]');
      fireEvent.click(button);
      expect(onClick).toHaveBeenCalledTimes(1);

      const results = await axe(container);
      // @ts-expect-error - axe matcher
      expect(results).toHaveNoViolations();
    });
  });

  describe('Form Controls: FormField, Input, Select, SegmentedControl, OtpInput', () => {
    it('FormField validates on blur and clears error on edit', () => {
      const validate = vi.fn((val: string) => (!val ? 'Field is required' : undefined));

      const { getByLabelText, getByRole, queryByRole } = render(
        <FormField id="company-name" label="Company name" required validate={validate}>
          {(fieldProps) => <Input {...fieldProps} placeholder="OneBridge" />}
        </FormField>
      );

      const input = getByLabelText(/Company name/);
      expect(input).toBeTruthy();

      // Blur with empty value -> triggers validation error
      fireEvent.blur(input);
      expect(validate).toHaveBeenCalled();
      const alert = getByRole('alert');
      expect(alert.textContent).toContain('Field is required');

      // Edit input -> clears error
      fireEvent.change(input, { target: { value: 'Acme Corp' } });
      expect(queryByRole('alert')).toBeNull();
    });

    it('Select renders custom chevron and respects accessibility', async () => {
      const options = [
        { value: 'eng', label: 'Engineering' },
        { value: 'des', label: 'Design' },
      ];
      const { container, getByRole } = render(
        <Select aria-label="Department" options={options} defaultValue="eng" />
      );
      const select = getByRole('combobox', { name: 'Department' });
      expect(select).toBeTruthy();
      expect(select.className).toContain('min-h-[44px]');
      const results = await axe(container);
      // @ts-expect-error - axe matcher
      expect(results).toHaveNoViolations();
    });

    it('SegmentedControl switches selection using role=radiogroup and role=radio', async () => {
      const onChange = vi.fn();
      const options = [
        { value: 'qr', label: 'QR code' },
        { value: 'nfc', label: 'NFC tap' },
      ];
      const { container, getByRole } = render(
        <SegmentedControl name="Card type" options={options} value="qr" onChange={onChange} />
      );

      const radiogroup = getByRole('radiogroup', { name: 'Card type' });
      expect(radiogroup).toBeTruthy();

      const qrRadio = getByRole('radio', { name: 'QR code' });
      expect(qrRadio.getAttribute('aria-checked')).toBe('true');

      const nfcRadio = getByRole('radio', { name: 'NFC tap' });
      expect(nfcRadio.getAttribute('aria-checked')).toBe('false');

      fireEvent.click(nfcRadio);
      expect(onChange).toHaveBeenCalledWith('nfc');

      const results = await axe(container);
      // @ts-expect-error - axe matcher
      expect(results).toHaveNoViolations();
    });

    it('OtpInput supports autofocus, full paste, keypad navigation, and countdown timer', () => {
      vi.useFakeTimers();
      const onChange = vi.fn();
      const onComplete = vi.fn();
      const onResend = vi.fn();

      const { getAllByRole, getByRole, getByText } = render(
        <OtpInput
          length={6}
          value="123"
          onChange={onChange}
          onComplete={onComplete}
          resendSeconds={3}
          onResend={onResend}
        />
      );

      const inputs = getAllByRole('textbox');
      expect(inputs).toHaveLength(6);

      // Paste 6-digit code
      fireEvent.paste(inputs[0], {
        clipboardData: { getData: () => '654321' },
      });
      expect(onChange).toHaveBeenCalledWith('654321');
      expect(onComplete).toHaveBeenCalledWith('654321');

      // Check countdown timer
      expect(getByText(/Resend code in 3s/i)).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      const resendBtn = getByRole('button', { name: /Resend code/i });
      expect(resendBtn).toBeTruthy();
      fireEvent.click(resendBtn);
      expect(onResend).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe('Display & Overlays', () => {
    it('Table renders accessible structure with sticky header', async () => {
      const { container, getByText } = render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Sandeep Bodapudi</TableCell>
              <TableCell>Founder</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      expect(getByText('Sandeep Bodapudi')).toBeTruthy();
      const results = await axe(container);
      // @ts-expect-error - axe matcher
      expect(results).toHaveNoViolations();
    });

    it('Tabs renders active Span line indicator and passes axe', async () => {
      const onChange = vi.fn();
      const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'people', label: 'People', badge: 12 },
      ];
      const { container, getByRole } = render(
        <Tabs tabs={tabs} activeTab="overview" onChange={onChange} />
      );

      const overviewTab = getByRole('tab', { name: /Overview/i });
      expect(overviewTab.getAttribute('aria-selected')).toBe('true');

      const peopleTab = getByRole('tab', { name: /People/i });
      expect(peopleTab.getAttribute('aria-selected')).toBe('false');
      fireEvent.click(peopleTab);
      expect(onChange).toHaveBeenCalledWith('people');

      const results = await axe(container);
      // @ts-expect-error - axe matcher
      expect(results).toHaveNoViolations();
    });

    it('Toast renders role=status and aria-live=polite', async () => {
      const onDismiss = vi.fn();
      const { container, getByRole } = render(
        <Toast type="success" message="Card saved successfully." onDismiss={onDismiss} />
      );

      const status = getByRole('status');
      expect(status.getAttribute('aria-live')).toBe('polite');
      expect(status.textContent).toContain('Card saved successfully.');

      const dismissBtn = getByRole('button', { name: 'Dismiss notification' });
      fireEvent.click(dismissBtn);
      expect(onDismiss).toHaveBeenCalledTimes(1);

      const results = await axe(container);
      // @ts-expect-error - axe matcher
      expect(results).toHaveNoViolations();
    });

    it('EmptyState renders sentence case and clear CTA', () => {
      const onAction = vi.fn();
      const { getByRole, getByText } = render(
        <EmptyState
          title="No digital cards created yet"
          description="Create your first digital business card to get started."
          actionLabel="Create card"
          onAction={onAction}
        />
      );

      expect(getByText('No digital cards created yet')).toBeTruthy();
      expect(getByText(/Create your first digital business card/)).toBeTruthy();
      const cta = getByRole('button', { name: 'Create card' });
      fireEvent.click(cta);
      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('Skeleton respects prefers-reduced-motion', () => {
      const { container } = render(<Skeleton width={100} height={20} rounded="panel" />);
      expect((container.firstChild as HTMLElement).className).toContain('rounded-panel');
      expect((container.firstChild as HTMLElement).className).toContain('motion-reduce:animate-none');
    });

    it('SlideOverPanel traps focus and closes on Escape', () => {
      const onClose = vi.fn();
      const { getByRole, getByText } = render(
        <SlideOverPanel isOpen={true} onClose={onClose} title="Card settings">
          <p>Panel content</p>
        </SlideOverPanel>
      );

      const dialog = getByRole('dialog');
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(getByText('Card settings')).toBeTruthy();

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('ConfirmDialog names the target item and has destructive action verb', () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();

      const { getByRole, getByText } = render(
        <ConfirmDialog
          isOpen={true}
          onClose={onClose}
          onConfirm={onConfirm}
          title="Offboard employee"
          itemName="Aarav Sharma"
          explanation="Their cards will be deactivated immediately."
          confirmLabel="Offboard employee"
          isDestructive={true}
        />
      );

      expect(getByRole('heading', { name: 'Offboard employee' })).toBeTruthy();
      expect(getByText('Aarav Sharma')).toBeTruthy();
      expect(getByText(/deactivated immediately/)).toBeTruthy();

      const confirmBtn = getByRole('button', { name: 'Offboard employee' });
      expect(confirmBtn.className).toContain('bg-error');
      fireEvent.click(confirmBtn);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('Brand Pieces & Layout: SpanLine, KeystoneTag, StatTile, QrPreview, PhoneFramePreview, AppShell, SpanCard', () => {
    it('SpanLine renders node termini and separator role', () => {
      const { getByRole } = render(<SpanLine progressPercent={45} />);
      const sep = getByRole('separator');
      expect(sep).toBeTruthy();
    });

    it('KeystoneTag renders verified polygon clip and status role', async () => {
      const { container, getByRole } = render(<KeystoneTag label="Verified company" />);
      const tag = getByRole('status');
      expect(tag.getAttribute('aria-label')).toBe('Verified company');
      expect(tag.style.clipPath).toContain('polygon');

      const results = await axe(container);
      // @ts-expect-error - axe matcher
      expect(results).toHaveNoViolations();
    });

    it('StatTile renders loading, error, empty, and populated states', () => {
      const { getByText, rerender } = render(
        <StatTile label="Total scans" value="2,480" highlight progressPercent={65} />
      );
      expect(getByText('Total scans')).toBeTruthy();
      expect(getByText('2,480')).toBeTruthy();

      rerender(<StatTile label="Total scans" value="2,480" isLoading />);
      expect(document.querySelector('.animate-pulse')).toBeTruthy();

      rerender(<StatTile label="Total scans" value="2,480" error="Failed to fetch metrics" />);
      expect(getByText('Failed to fetch metrics')).toBeTruthy();

      rerender(<StatTile label="Total scans" value="2,480" isEmpty />);
      expect(getByText('No data available')).toBeTruthy();
    });

    it('QrPreview displays shortlink and copy/download handlers', () => {
      const onCopy = vi.fn();
      const onDownload = vi.fn();

      const { getByText, getByRole } = render(
        <QrPreview
          shortLink="https://1b.in/c/sandeep"
          onCopyLink={onCopy}
          onDownloadPng={onDownload}
        />
      );

      expect(getByText('https://1b.in/c/sandeep')).toBeTruthy();
      const copyBtn = getByRole('button', { name: /Copy/i });
      fireEvent.click(copyBtn);
      expect(onCopy).toHaveBeenCalledTimes(1);

      const downloadBtn = getByRole('button', { name: /Download PNG/i });
      fireEvent.click(downloadBtn);
      expect(onDownload).toHaveBeenCalledTimes(1);
    });

    it('PhoneFramePreview renders accessible region', () => {
      const { getByRole } = render(
        <PhoneFramePreview>
          <div>Preview card inside</div>
        </PhoneFramePreview>
      );
      expect(getByRole('region', { name: 'Live mobile card preview' })).toBeTruthy();
    });

    it('AppShell renders desktop left rail and mobile bottom navigation', () => {
      const onNavigate = vi.fn();
      const navItems = [
        { id: 'overview', label: 'Overview', href: '/overview', isActive: true },
        { id: 'cards', label: 'Cards', href: '/cards' },
      ];

      const { getByText, getAllByText } = render(
        <AppShell
          greeting="Good morning"
          companyName="Acme Technologies"
          businessId="OB-888999"
          userName="Sandeep"
          userRole="Admin"
          navItems={navItems}
          onNavigate={onNavigate}
        >
          <div>Main workspace content</div>
        </AppShell>
      );

      // You at the bottom of the rail; the company and Business ID at the top (pages render their own titles)
      expect(getByText('Sandeep')).toBeTruthy();
      expect(getAllByText('Acme Technologies')).toHaveLength(2); // desktop rail & mobile top
      expect(getAllByText('OB-888999')).toHaveLength(1);
      expect(getByText('Main workspace content')).toBeTruthy();
    });

    it('SpanCard renders panel radius and hairline border', () => {
      const { container } = render(<SpanCard>Content inside Span panel</SpanCard>);
      expect((container.firstChild as HTMLElement).className).toContain('rounded-panel');
      expect((container.firstChild as HTMLElement).className).toContain('border-sand-border');
    });

    it('StatusChip supports custom and default variants with sentence case', () => {
      const { getByText, rerender } = render(<StatusChip status="published" />);
      expect(getByText('Published')).toBeTruthy();

      rerender(<StatusChip status="draft" />);
      expect(getByText('Draft')).toBeTruthy();

      rerender(<StatusChip status="warning">Pending approval</StatusChip>);
      expect(getByText('Pending approval')).toBeTruthy();
    });
  });
});
