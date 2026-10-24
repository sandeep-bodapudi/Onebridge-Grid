// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import React from 'react';
import { ActionButton } from '../src/components/ActionButton';
import {
  StatusChip,
  OfflineBanner,
  StatTile,
  BusinessIdDisplay,
  OrgStructure,
  orgStructureLabelsHi,
  SeatsManagement,
  seatsLabelsHi,
  BrandKitManager,
  AuditLogViewer,
  defaultBrandKitLabelsHi,
  defaultAuditLogLabelsHi,
  AuditLogItem,
  NeutralInactivePage,
  QrDownloadModal,
  SourceTagManager,
} from '../src/components/index';

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

  it('BusinessIdDisplay renders Business ID with copy button and handles states', () => {
    const { getByText, getByRole, rerender } = render(
      <BusinessIdDisplay businessId="OB-7KQ2MX" />
    );
    expect(getByText('OB-7KQ2MX')).toBeTruthy();
    expect(getByRole('button', { name: /copy/i })).toBeTruthy();

    // Loading state
    rerender(<BusinessIdDisplay businessId="OB-7KQ2MX" isLoading />);
    expect(getByRole('button', { name: /copy/i })).toHaveProperty('disabled', true);

    // Empty state
    rerender(<BusinessIdDisplay businessId="" isEmpty />);
    expect(getByText(/no business id/i)).toBeTruthy();

    // Offline state
    rerender(<BusinessIdDisplay businessId="OB-7KQ2MX" isOffline />);
    expect(getByText(/offline/i)).toBeTruthy();
  });

  it('BusinessIdDisplay should not have basic accessibility violations across variants', async () => {
    const { container, rerender } = render(<BusinessIdDisplay businessId="OB-7KQ2MX" variant="settings" />);
    let results = await axe(container);
    // @ts-expect-error - jest-axe types do not extend vitest Assertion globally without conflicts
    expect(results).toHaveNoViolations();

    rerender(<BusinessIdDisplay businessId="OB-7KQ2MX" variant="rail" />);
    results = await axe(container);
    // @ts-expect-error - jest-axe types do not extend vitest Assertion globally without conflicts
    expect(results).toHaveNoViolations();

    rerender(<BusinessIdDisplay businessId="OB-7KQ2MX" variant="public" />);
    results = await axe(container);
    // @ts-expect-error - jest-axe types do not extend vitest Assertion globally without conflicts
    expect(results).toHaveNoViolations();

    rerender(<BusinessIdDisplay businessId="OB-7KQ2MX" variant="badge" />);
    results = await axe(container);
    // @ts-expect-error - jest-axe types do not extend vitest Assertion globally without conflicts
    expect(results).toHaveNoViolations();
  });

  it('OrgStructure renders all required states: Empty, First-branch prompt, Plan Limit, Archive Modal, and Tree', async () => {
    const { getByTestId, rerender } = render(
      <OrgStructure branches={[]} departments={[]} plan="starter" />
    );

    // 1. Empty state & First-branch prompt
    expect(getByTestId('empty-org-state')).toBeTruthy();
    expect(getByTestId('first-branch-prompt-button')).toBeTruthy();

    // 2. Loading state
    rerender(<OrgStructure isLoading />);
    expect(getByTestId('org-structure-loading')).toBeTruthy();

    // 3. Plan limit reached on Starter (1 branch)
    rerender(
      <OrgStructure
        plan="starter"
        onAddBranch={() => {}}
        branches={[
          {
            id: 'OB-7KQ2MX-B01',
            tenantId: 't1',
            name: 'HQ Bengaluru',
            address: { line1: 'MG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]}
      />
    );
    expect(getByTestId('plan-limit-reached-card')).toBeTruthy();
    expect(getByTestId('add-branch-button')).toHaveProperty('disabled', true);

    // 4. Offline state
    rerender(
      <OrgStructure
        isOffline
        branches={[
          {
            id: 'OB-7KQ2MX-B01',
            tenantId: 't1',
            name: 'HQ Bengaluru',
            address: { line1: 'MG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]}
      />
    );
    expect(getByTestId('org-structure-offline-banner')).toBeTruthy();
  });

  it('OrgStructure should not have basic accessibility violations across states', async () => {
    const { container } = render(
      <OrgStructure
        branches={[
          {
            id: 'OB-7KQ2MX-B01',
            name: 'HQ Bengaluru',
            address: { line1: 'MG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
            status: 'active',
          },
        ]}
        departments={[
          { id: 'OB-7KQ2MX-D01', name: 'Engineering', status: 'active' },
        ]}
        plan="business"
      />
    );
    const results = await axe(container);
    // @ts-expect-error - jest-axe types do not extend vitest Assertion globally without conflicts
    expect(results).toHaveNoViolations();
  });

  it('OrgStructure renders correctly with Hindi localization labels', () => {
    const { getByText } = render(
      <OrgStructure
        labels={orgStructureLabelsHi}
        branches={[]}
        departments={[]}
      />
    );
    expect(getByText('संगठन संरचना')).toBeTruthy();
    expect(getByText('अपनी पहली शाखा स्थापित करें')).toBeTruthy();
    expect(getByText('प्राथमिक शाखा बनाएं')).toBeTruthy();
  });

  // ===========================================================================
  // SeatsManagement Component Tests (F08)
  // ===========================================================================
  it('SeatsManagement renders loading state with skeleton pulses', () => {
    const { getByTestId } = render(<SeatsManagement seats={[]} isLoading />);
    expect(getByTestId('seats-loading')).toBeTruthy();
  });

  it('SeatsManagement renders empty state with CTA', () => {
    const { getByTestId, getByText } = render(
      <SeatsManagement seats={[]} onCreateSeat={() => {}} />
    );
    expect(getByTestId('seats-empty-state')).toBeTruthy();
    expect(getByText('No seats yet')).toBeTruthy();
  });

  it('SeatsManagement renders error and offline status banners', () => {
    const { getByText, getByRole } = render(
      <SeatsManagement
        seats={[]}
        error="Network error fetching seats"
        isOffline
      />
    );
    expect(getByRole('alert')).toBeTruthy();
    expect(getByText('Network error fetching seats')).toBeTruthy();
    expect(getByRole('status')).toBeTruthy();
    expect(getByText(/viewing cached seats and people/i)).toBeTruthy();
  });

  it('SeatsManagement displays over-limit banner and read-only badge when seats exceed plan limit', () => {
    const { getByTestId, getByText } = render(
      <SeatsManagement
        seats={[
          {
            id: 'OB-7KQ2MX-E0001',
            tenantId: 'tenant_1',
            title: 'Lead Architect',
            status: 'active',
            isReadOnly: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]}
        total={6}
        maxSeats={5}
        plan="starter"
      />
    );
    expect(getByTestId('over-limit-banner')).toBeTruthy();
    expect(getByTestId('readonly-badge-OB-7KQ2MX-E0001')).toBeTruthy();
    expect(getByText(/plan seat limit reached/i)).toBeTruthy();
  });

  it('SeatsManagement renders vacant and active seats with bindings, and satisfies axe accessibility', async () => {
    const { container, getAllByText, getByTestId } = render(
      <SeatsManagement
        seats={[
          {
            id: 'OB-7KQ2MX-E0001',
            tenantId: 'tenant_1',
            title: 'Vacant AE Seat',
            status: 'vacant',
            isReadOnly: false,
            cardBinding: {
              cardId: 'card_1',
              cardUrl: 'https://onebridge.in/c/OB-7KQ2MX-E0001',
              nfcChipId: 'chip_001',
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'OB-7KQ2MX-E0002',
            tenantId: 'tenant_1',
            title: 'Active Director',
            personId: 'person_vikram',
            status: 'active',
            isReadOnly: false,
            cardBinding: {
              cardId: 'card_2',
              cardUrl: 'https://onebridge.in/c/OB-7KQ2MX-E0002',
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]}
        plan="business"
      />
    );

    expect(getByTestId('seat-card-OB-7KQ2MX-E0001')).toBeTruthy();
    expect(getByTestId('seat-card-OB-7KQ2MX-E0002')).toBeTruthy();
    // The selected person also appears in the detail panel beside the table on wide screens.
    expect(getAllByText('Vacant AE Seat').length).toBeGreaterThan(0);
    expect(getAllByText('Active Director').length).toBeGreaterThan(0);
    // People are shown by name, never by person ID.
    expect(container.textContent).not.toContain('person_vikram');

    const results = await axe(container);
    // @ts-expect-error - jest-axe types do not extend vitest Assertion globally without conflicts
    expect(results).toHaveNoViolations();
  });

  it('SeatsManagement renders correctly with Hindi localization labels', () => {
    const { getByText, getAllByText } = render(
      <SeatsManagement
        seats={[]}
        labels={seatsLabelsHi}
        onCreateSeat={() => {}}
      />
    );
    expect(getByText('सीटें और लोग')).toBeTruthy();
    expect(getByText('अभी तक कोई सीट कॉन्फ़िगर नहीं की गई है')).toBeTruthy();
    expect(getAllByText('सीट जोड़ें').length).toBeGreaterThan(0);
  });

  it('SeatsManagement shows names, real card links and asks before offboarding', async () => {
    const onArchiveSeat = vi.fn();
    const { getByText, getAllByText, getByRole, queryByRole } = render(
      <SeatsManagement
        plan="business"
        onArchiveSeat={onArchiveSeat}
        seats={[
          {
            id: 'OB-7KQ2MX-E0002',
            tenantId: 'tenant_1',
            title: 'Head of sales',
            status: 'active',
            isReadOnly: false,
            displayName: 'Rohit Deshmukh',
            cardStatus: 'published',
            cardPublicUrl: 'https://cards.example/c/acme/ob-7kq2mx-e0002',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]}
      />
    );
    expect(getAllByText('Rohit Deshmukh').length).toBeGreaterThan(0);
    fireEvent.click(getByRole('button', { name: /manage rohit deshmukh/i }));
    expect(getByRole('link', { name: /open card/i }).getAttribute('href')).toBe('https://cards.example/c/acme/ob-7kq2mx-e0002');
    fireEvent.click(getByRole('button', { name: 'Offboard Rohit Deshmukh' }));
    expect(onArchiveSeat).not.toHaveBeenCalled();
    expect(getByText(/this affects/i).textContent).toContain('Rohit Deshmukh, Head of sales');
    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Offboard' }));
    });
    expect(onArchiveSeat).toHaveBeenCalledWith('OB-7KQ2MX-E0002');
    expect(queryByRole('dialog')).toBeNull();
  });

  it('SeatsManagement add-seat form validates on blur and sends name and phone', async () => {
    const onCreateSeat = vi.fn().mockResolvedValue(undefined);
    const { getByTestId, getByLabelText, getByText, queryByText } = render(<SeatsManagement seats={[]} onCreateSeat={onCreateSeat} />);
    fireEvent.click(getByTestId('add-seat-button'));
    const phone = getByLabelText(/mobile number/i);
    fireEvent.change(phone, { target: { value: '12345' } });
    fireEvent.blur(phone);
    expect(getByText(/10-digit indian mobile number/i)).toBeTruthy();
    fireEvent.change(phone, { target: { value: '98220 12345' } });
    expect(queryByText(/10-digit indian mobile number/i)).toBeNull();
    fireEvent.change(getByLabelText(/job title/i), { target: { value: 'Head of sales' } });
    fireEvent.change(getByLabelText(/full name/i), { target: { value: 'Rohit Deshmukh' } });
    await act(async () => {
      fireEvent.submit(document.getElementById('add-seat-form') as HTMLFormElement);
    });
    expect(onCreateSeat).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Head of sales', name: 'Rohit Deshmukh', phone: '98220 12345' })
    );
  });

  describe('BrandKitManager Component', () => {
    it('renders brand kit manager and card preview with no accessibility violations', async () => {
      const { container, getByText, getAllByText } = render(
        <BrandKitManager
          initialBrandKit={{
            logo: 'https://cdn.example.com/logo.png',
            brandColours: { band: '#1B2A4A', accent: '#F68713', text: '#FFFFFF' },
            coverImage: 'https://cdn.example.com/cover.jpg',
          }}
          initialLocks={{ lockedFields: ['title', 'departmentId'] }}
          userRole="admin"
        />
      );

      expect(getByText('Brand kit')).toBeTruthy();
      expect(getAllByText('Company logo').length).toBeGreaterThan(0);
      expect(getAllByText('Brand colours').length).toBeGreaterThan(0);
      expect(getByText('Card preview')).toBeTruthy();
      expect(getByText('Easy to read (WCAG AA pass)', { exact: false })).toBeTruthy();

      const results = await axe(container);
      // @ts-expect-error - jest-axe types
      expect(results).toHaveNoViolations();
    });

    it('displays contrast warning and auto-pick option on low-contrast colour combinations', () => {
      const { getByText } = render(
        <BrandKitManager
          initialBrandKit={{
            logo: null,
            brandColours: { band: '#F68713', accent: '#1B2A4A', text: '#FFFFFF' },
            coverImage: null,
          }}
          userRole="admin"
        />
      );

      expect(getByText('Hard to read', { exact: false })).toBeTruthy();
      expect(getByText(/Text contrast is below 4.5:1/i)).toBeTruthy();
      expect(getByText(/Apply recommended text colour/i)).toBeTruthy();
    });

    it('enforces read-only locks view and displays lock notice for employee role', () => {
      const { getByText, queryByText } = render(
        <BrandKitManager
          initialBrandKit={{
            logo: null,
            brandColours: { band: '#1B2A4A', accent: '#F68713', text: '#FFFFFF' },
            coverImage: null,
          }}
          initialLocks={{ lockedFields: ['title', 'logo'] }}
          userRole="employee"
        />
      );

      expect(getByText(/Some fields are locked by your organization administrator/i)).toBeTruthy();
      // Admin save & reset buttons should not be visible for employees
      expect(queryByText('Save brand kit')).toBeNull();
      expect(queryByText('Lock')).toBeNull();
    });

    it('renders correctly with Hindi localization', () => {
      const { getByText, getAllByText } = render(
        <BrandKitManager
          labels={defaultBrandKitLabelsHi}
          userRole="admin"
        />
      );

      expect(getByText('ब्रांड किट और कार्ड लॉक')).toBeTruthy();
      expect(getAllByText('कंपनी लोगो').length).toBeGreaterThan(0);
      expect(getByText('ब्रांड रंग')).toBeTruthy();
      expect(getByText('कर्मचारी फ़ील्ड लॉक')).toBeTruthy();
    });

    it('renders offline and loading states gracefully', () => {
      const { getByText, rerender, container } = render(
        <BrandKitManager
          isOffline={true}
          userRole="admin"
        />
      );
      expect(getByText(/You are currently offline/i)).toBeTruthy();

      rerender(
        <BrandKitManager
          isLoading={true}
          userRole="admin"
        />
      );
      expect(container.querySelector('.animate-pulse')).toBeTruthy();
    });

    it('updates live card preview dynamically as the admin types (AC-3)', () => {
      const { getByLabelText, getByTestId } = render(
        <BrandKitManager
          initialBrandKit={{
            logo: null,
            brandColours: { band: '#1B2A4A', accent: '#F68713', text: '#FFFFFF' },
            coverImage: null,
          }}
          userRole="admin"
        />
      );

      const headerBand = getByTestId('preview-header-band');
      expect(headerBand.style.backgroundColor).toBe('rgb(27, 42, 74)'); // #1B2A4A in rgb

      // Simulate typing a new band hex
      const bandHexInput = getByLabelText('Header colour');
      fireEvent.change(bandHexInput, { target: { value: '#0A2540' } });

      // Live preview header band updates immediately
      expect(headerBand.style.backgroundColor).toBe('rgb(10, 37, 64)'); // #0A2540 in rgb

      // Simulate typing a new text hex
      const textHexInput = getByLabelText('Header text colour');
      fireEvent.change(textHexInput, { target: { value: '#FAF7F2' } });

      const cardName = getByTestId('preview-card-name');
      expect(cardName.style.color).toBe('rgb(250, 247, 242)'); // #FAF7F2 in rgb
    });

    it('prevents saving with low contrast until admin applies auto-pick recommendation (AC-4)', async () => {
      const onSaveBrandKit = vi.fn().mockResolvedValue(undefined);
      const { getByLabelText, getByText, queryByText } = render(
        <BrandKitManager
          initialBrandKit={{
            logo: null,
            brandColours: { band: '#1B2A4A', accent: '#F68713', text: '#FFFFFF' },
            coverImage: null,
          }}
          onSaveBrandKit={onSaveBrandKit}
          userRole="admin"
        />
      );

      // Change band colour to orange with white text (contrast ~2.5:1, unreadable)
      const bandHexInput = getByLabelText('Header colour');
      fireEvent.change(bandHexInput, { target: { value: '#F68713' } });

      // Contrast warning displayed
      expect(getByText(/Text contrast is below 4.5:1/i)).toBeTruthy();

      // Save button is disabled due to inaccessible contrast
      const saveBtn = getByText('Save brand kit').closest('button');
      expect(saveBtn?.disabled).toBe(true);

      // Admin clicks "Apply recommended text colour"
      const applyBtn = getByText(/Apply recommended text colour/i);
      await act(async () => {
        fireEvent.click(applyBtn);
      });

      // Warning disappears / passes AA
      expect(queryByText(/Text contrast is below 4.5:1/i)).toBeNull();
      expect(getByText('Easy to read (WCAG AA pass)', { exact: false })).toBeTruthy();

      // Save button is now enabled
      expect(saveBtn?.disabled).toBe(false);

      // Admin can now successfully save
      await act(async () => {
        fireEvent.click(saveBtn!);
      });
      expect(onSaveBrandKit).toHaveBeenCalledTimes(1);
      expect(onSaveBrandKit).toHaveBeenCalledWith(
        expect.objectContaining({
          brandColours: expect.objectContaining({
            band: '#F68713',
            text: '#393536', // Charcoal applied via auto-pick
          }),
        }),
        false
      );
    });

    it('displays locked field tooltip explaining lock policy for locked fields', () => {
      const { getByTestId } = render(
        <BrandKitManager
          initialBrandKit={{
            logo: null,
            brandColours: { band: '#1B2A4A', accent: '#F68713', text: '#FFFFFF' },
            coverImage: null,
          }}
          initialLocks={{ lockedFields: ['title', 'departmentId'] }}
          userRole="admin"
        />
      );

      const titleRow = getByTestId('field-row-title');
      expect(titleRow.getAttribute('title')).toBe(
        'Locked by organization policy. Employees cannot modify this field on their cards.'
      );

      const deptStatus = getByTestId('lock-status-departmentId');
      expect(deptStatus.getAttribute('title')).toBe(
        'Locked by organization policy. Employees cannot modify this field on their cards.'
      );
    });
  });

  describe('Feature F04: AuditLogViewer Component', () => {
    const sampleEntries: AuditLogItem[] = [
      {
        id: '01JD2XAUD00000000000000001',
        tenantId: '01JD2XORG00000000000000001',
        actor: '01JD2XPER00000000000000002',
        action: 'branch.created',
        entityType: 'branch',
        entityId: 'BR-001',
        ip: '192.168.1.1',
        before: null,
        after: { name: 'HQ', city: 'Bengaluru' },
        occurredAt: '2026-10-10T10:00:00.000Z',
      },
      {
        id: '01JD2XAUD00000000000000002',
        tenantId: '01JD2XORG00000000000000001',
        actor: '01JD2XPER00000000000000001',
        action: 'branch.updated',
        entityType: 'branch',
        entityId: 'BR-001',
        ip: '192.168.1.2',
        before: { name: 'HQ', city: 'Bengaluru' },
        after: { name: 'Headquarters', city: 'Bengaluru' },
        occurredAt: '2026-10-11T12:00:00.000Z',
      },
    ];

    it('renders audit entries and passes axe accessibility audit', async () => {
      const { container, getByText } = render(
        <AuditLogViewer entries={sampleEntries} total={2} />
      );

      expect(getByText('Audit log')).toBeTruthy();
      // Plain sentences, not event codes
      expect(getByText('added the branch', { exact: false })).toBeTruthy();
      expect(getByText('updated the branch', { exact: false })).toBeTruthy();

      const results = await axe(container);
      // @ts-expect-error - jest-axe types
      expect(results).toHaveNoViolations();
    });

    it('handles filter form inputs and submission', async () => {
      const onFilterChange = vi.fn();
      const { getByLabelText, getByTestId } = render(
        <AuditLogViewer
          entries={sampleEntries}
          total={2}
          onFilterChange={onFilterChange}
          actorNames={{ '01JD2XPER00000000000000001': 'Priya Kulkarni' }}
        />
      );

      // Dropdowns of people and actions instead of typed IDs
      const actorInput = getByLabelText('Person');
      const actionInput = getByLabelText('Action');

      fireEvent.change(actorInput, { target: { value: '01JD2XPER00000000000000001' } });
      fireEvent.change(actionInput, { target: { value: 'branch.updated' } });

      const submitBtn = getByTestId('apply-filters-btn');
      fireEvent.click(submitBtn);

      expect(onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: '01JD2XPER00000000000000001',
          action: 'branch.updated',
        })
      );
    });

    it('triggers CSV export and shows loading state when isExporting is true', () => {
      const onExportCsv = vi.fn();
      const { getByTestId, rerender } = render(
        <AuditLogViewer
          entries={sampleEntries}
          total={2}
          onExportCsv={onExportCsv}
          isExporting={false}
        />
      );

      const exportBtn = getByTestId('export-csv-btn');
      expect(exportBtn.textContent).toContain('Export to CSV');
      fireEvent.click(exportBtn);
      expect(onExportCsv).toHaveBeenCalledTimes(1);

      rerender(
        <AuditLogViewer
          entries={sampleEntries}
          total={2}
          onExportCsv={onExportCsv}
          isExporting={true}
        />
      );
      expect(exportBtn.textContent).toContain('Exporting...');
      expect((exportBtn as HTMLButtonElement).disabled).toBe(true);
    });

    it('opens diff modal on click and renders before and after payloads', async () => {
      const { getByTestId, queryByTestId, getByText } = render(
        <AuditLogViewer entries={sampleEntries} total={2} />
      );

      expect(queryByTestId('audit-diff-modal')).toBeNull();

      const viewDiffBtn = getByTestId(`view-diff-${sampleEntries[1].id}`);
      fireEvent.click(viewDiffBtn);

      expect(getByTestId('audit-diff-modal')).toBeTruthy();
      expect(getByTestId('audit-diff-modal').textContent).toContain('Headquarters');
      expect(getByText(/Confidential data redacted/)).toBeTruthy();

      const closeBtn = getByText('Close');
      fireEvent.click(closeBtn);

      expect(queryByTestId('audit-diff-modal')).toBeNull();
    });

    it('renders empty, filtered empty, error, and offline states', () => {
      const onRetry = vi.fn();
      const { getByTestId, rerender, getByText } = render(
        <AuditLogViewer entries={[]} total={0} isLoading={false} />
      );

      expect(getByTestId('audit-empty-state')).toBeTruthy();
      expect(getByText('No audit records yet')).toBeTruthy();

      // Filtered empty state
      rerender(
        <AuditLogViewer
          entries={[]}
          total={0}
          filters={{ actor: 'UNKNOWN' }}
          isLoading={false}
        />
      );
      expect(getByTestId('audit-no-results')).toBeTruthy();

      // Error state
      rerender(
        <AuditLogViewer
          entries={[]}
          total={0}
          error="Network timeout connecting to server"
          onRetry={onRetry}
        />
      );
      expect(getByTestId('audit-error-state')).toBeTruthy();
      expect(getByText('Network timeout connecting to server')).toBeTruthy();
      const retryBtn = getByText('Retry');
      fireEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalledTimes(1);

      // Offline state
      rerender(
        <AuditLogViewer
          entries={sampleEntries}
          total={2}
          isOffline={true}
        />
      );
      expect(getByText(/You are currently offline/i)).toBeTruthy();
    });

    it('supports Hindi localization', () => {
      const { getByText } = render(
        <AuditLogViewer
          entries={sampleEntries}
          total={2}
          labels={defaultAuditLogLabelsHi}
        />
      );

      expect(getByText('ऑडिट ट्रेल')).toBeTruthy();
      expect(getByText('CSV में निर्यात करें')).toBeTruthy();
    });
  });

  describe('NeutralInactivePage (AC-3)', () => {
    it('renders default neutral message without personal data', () => {
      const { getByText, queryByText } = render(<NeutralInactivePage />);
      expect(getByText('Card or link inactive')).toBeTruthy();
      expect(getByText(/This OneBridge Grid card, link, or NFC chip is currently inactive/i)).toBeTruthy();
      // Ensure strictly NO personal data is present
      expect(queryByText(/Rahul/i)).toBeNull();
      expect(queryByText(/@/i)).toBeNull();
      expect(queryByText(/\+91/i)).toBeNull();
    });

    it('renders custom titles when provided', () => {
      const { getByText } = render(
        <NeutralInactivePage
          title="Chip not activated"
          message="Please tap card again or activate in portal."
        />
      );
      expect(getByText('Chip not activated')).toBeTruthy();
      expect(getByText('Please tap card again or activate in portal.')).toBeTruthy();
    });
  });

  describe('QrDownloadModal (AC-2, AC-5)', () => {
    it('renders download options and calls onDownload with chosen format and resolution', () => {
      const onDownload = vi.fn();
      const onClose = vi.fn();

      const { getByText, getByRole } = render(
        <QrDownloadModal
          isOpen={true}
          onClose={onClose}
          qrId="qr_123"
          sourceLabel="Event Desk"
          shortUrl="https://1b.co/r/evnt1234"
          onDownload={onDownload}
        />
      );

      expect(getByText('Download branded QR code')).toBeTruthy();
      expect(getByText(/Event Desk/i)).toBeTruthy();

      // Click SVG format option
      const svgBtn = getByRole('button', { name: /svg/i });
      fireEvent.click(svgBtn);

      // Click download button
      const downloadBtn = getByRole('button', { name: /Download file/i });
      fireEvent.click(downloadBtn);

      expect(onDownload).toHaveBeenCalledTimes(1);
      expect(onDownload).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'svg',
        })
      );
    });

    it('returns null when isOpen is false', () => {
      const { container } = render(
        <QrDownloadModal
          isOpen={false}
          onClose={vi.fn()}
          qrId="qr_123"
          sourceLabel="Desk"
          shortUrl="https://1b.co/r/test1234"
          onDownload={vi.fn()}
        />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('SourceTagManager (AC-4, AC-6)', () => {
    const sampleItems = [
      {
        id: 'qr_1',
        code: 'dflt1234',
        shortUrl: 'https://1b.co/r/dflt1234',
        source: 'default',
        label: 'Default Card Link',
        destinationUrl: 'https://onebridge.in/p/c_1',
        status: 'active' as const,
      },
      {
        id: 'qr_2',
        code: 'conf1234',
        shortUrl: 'https://1b.co/r/conf1234',
        source: 'conference_booth',
        label: 'Tech Expo Booth',
        destinationUrl: 'https://onebridge.in/p/c_1?src=conf',
        status: 'active' as const,
      },
    ];

    it('renders list of tagged short links and handles empty state', () => {
      const onCreate = vi.fn().mockResolvedValue(undefined);
      const onDownload = vi.fn();

      const { getByText, rerender } = render(
        <SourceTagManager
          cardId="c_1"
          cardName="Rajesh Sharma"
          items={sampleItems}
          onCreateTag={onCreate}
          onDownloadAsset={onDownload}
        />
      );

      expect(getByText('Default Card Link')).toBeTruthy();
      expect(getByText('Tech Expo Booth')).toBeTruthy();

      // Empty state
      rerender(
        <SourceTagManager
          cardId="c_1"
          items={[]}
          onCreateTag={onCreate}
          onDownloadAsset={onDownload}
        />
      );
      expect(getByText(/No QR tags created yet/i)).toBeTruthy();
    });

    it('displays loading, error, and offline states', () => {
      const onCreate = vi.fn().mockResolvedValue(undefined);
      const onDownload = vi.fn();

      const { getByText, rerender, container } = render(
        <SourceTagManager
          cardId="c_1"
          items={[]}
          isLoading={true}
          onCreateTag={onCreate}
          onDownloadAsset={onDownload}
        />
      );
      expect(container.querySelector('.animate-pulse')).toBeTruthy();

      // Error state
      rerender(
        <SourceTagManager
          cardId="c_1"
          items={[]}
          error="Failed to load tags from API"
          onCreateTag={onCreate}
          onDownloadAsset={onDownload}
        />
      );
      expect(getByText('Failed to load tags from API')).toBeTruthy();

      // Offline banner
      rerender(
        <SourceTagManager
          cardId="c_1"
          items={sampleItems}
          isOffline={true}
          onCreateTag={onCreate}
          onDownloadAsset={onDownload}
        />
      );
      expect(getByText(/You are currently offline/i)).toBeTruthy();
    });

    it('opens create modal, submits new tag, and opens download modal', async () => {
      const onCreate = vi.fn().mockResolvedValue(undefined);
      const onDownload = vi.fn();

      const { getByText, getByPlaceholderText, getAllByText } = render(
        <SourceTagManager
          cardId="c_1"
          items={sampleItems}
          onCreateTag={onCreate}
          onDownloadAsset={onDownload}
        />
      );

      // Open the new QR form
      fireEvent.click(getByText('Add QR for an event or place'));

      const labelInput = getByPlaceholderText(/Exhibition Hall B/i);
      fireEvent.change(labelInput, { target: { value: 'LinkedIn Bio' } });

      // The tag is filled in from the name, and can be edited
      const sourceInput = getByPlaceholderText(/expo_2026/i) as HTMLInputElement;
      expect(sourceInput.value).toBe('linkedin_bio');

      const createBtn = getByText('Create QR tag');
      await act(async () => {
        fireEvent.click(createBtn);
      });

      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'linkedin_bio',
          label: 'LinkedIn Bio',
        })
      );

      // Open download modal (event QRs list "Download QR"; the main QR offers "More formats")
      const downloadButtons = getAllByText('Download QR');
      fireEvent.click(downloadButtons[0]);

      expect(getByText('Download branded QR code')).toBeTruthy();
    });
  });
});


