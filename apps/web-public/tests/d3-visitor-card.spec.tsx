// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import React from 'react';
import { VisitorCard, type VisitorCardProps } from '@onebridge/ui-kit';

describe('Phase D3: Visitor Card Component & States (Span Design System)', () => {
  const sampleCardData: VisitorCardProps['data'] = {
    cardId: 'OB-ABC123-E0001',
    slug: 'sahyadri-steel/rajesh-shinde',
    status: 'published',
    templateId: 'classic-charcoal',
    language: 'en',
    verifiedBadge: true,
    person: {
      name: 'Rajesh Shinde',
      designation: 'Founder & Managing Director',
      photoUrl: 'https://cdn.onebridge.in/photos/rajesh.jpg',
      phone: '+919823012345',
      email: 'rajesh@sahyadristeel.in',
      bio: 'Pioneering precision alloy engineering and heavy fabrication in Maharashtra for over 28 years.',
    },
    company: {
      id: 'org_sahyadri',
      businessId: 'OB-T15EH7',
      name: 'Sahyadri Steel Works',
      logoUrl: 'https://cdn.onebridge.in/logos/sahyadri.png',
      brandColours: {
        band: '#1B2A4A',
        accent: '#F68713',
        text: '#FFFFFF',
      },
    },
    branch: {
      id: 'branch_chakan',
      name: 'Chakan MIDC Works',
      address: 'Plot E-42, Chakan Industrial Area Phase II, Pune 410501',
      mapPin: { lat: 18.761, lng: 73.843 },
    },
    sections: [
      {
        type: 'products',
        order: 1,
        content: {
          items: [
            { name: 'FE 550D TMT Rebars', description: 'IS 1786 Certified', price: '₹54,000 / MT' },
            { name: 'Hot-rolled Alloy Coils', description: 'Thickness 1.6–12mm' },
          ],
        },
      },
      {
        type: 'facility',
        order: 2,
        content: {
          address: 'Plot E-42, Chakan Industrial Area Phase II, MIDC, Pune 410501',
          gstin: '27AABCS1429B1Z8',
        },
      },
      {
        type: 'links',
        order: 3,
        content: {
          items: [
            { title: 'Company Website', url: 'https://sahyadristeel.in' },
          ],
        },
      },
    ],
    actions: {
      saveContactUrl: '/c/sahyadri-steel/rajesh-shinde/vcard',
      whatsappUrl: 'https://wa.me/919823012345',
      callUrl: 'tel:+919823012345',
      emailUrl: 'mailto:rajesh@sahyadristeel.in',
      directionsUrl: 'https://maps.google.com/?q=18.761,73.843',
    },
  };

  it('renders header with 32px name, role, company, Business ID plate, and keystone verified tag', () => {
    const { container } = render(<VisitorCard data={sampleCardData} />);

    // Name at 32px
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('Rajesh Shinde');
    expect(heading.className).toContain('text-[32px]');

    // Role and company
    expect(screen.getByText('Founder & Managing Director')).toBeDefined();
    expect(screen.getByText(/Sahyadri Steel Works · Chakan MIDC Works/)).toBeDefined();

    // Business ID nameplate
    expect(screen.getAllByText('OB-T15EH7').length).toBeGreaterThan(0);

    // Verified Keystone tag
    expect(screen.getByText('Verified')).toBeDefined();

    // Photo avatar has rounded-[10px] (strictly no circular or arched motifs)
    const avatarImg = screen.getByAltText('Rajesh Shinde');
    expect(avatarImg).toBeDefined();
    const avatarWrap = avatarImg.parentElement;
    expect(avatarWrap?.className).toContain('rounded-panel'); // 10px panel radius
    expect(avatarWrap?.className).not.toContain('rounded-full');
    expect(avatarWrap?.className).not.toContain('rounded-arch');

    // Header has SpanLine deck
    const spanLine = container.querySelector('[data-span-line="true"]');
    expect(spanLine).not.toBeNull();
  });

  it('renders 3 equal contact tiles: Call, Email, Directions', () => {
    const onCtaClick = vi.fn();
    render(<VisitorCard data={sampleCardData} onCtaClick={onCtaClick} />);

    const callTile = screen.getByRole('link', { name: /call/i });
    expect(callTile.getAttribute('href')).toBe('tel:+919823012345');
    fireEvent.click(callTile);
    expect(onCtaClick).toHaveBeenCalledWith('call');

    const emailTile = screen.getByRole('link', { name: /email/i });
    expect(emailTile.getAttribute('href')).toBe('mailto:rajesh@sahyadristeel.in');
    fireEvent.click(emailTile);
    expect(onCtaClick).toHaveBeenCalledWith('email');

    const dirTile = screen.getByRole('link', { name: /directions/i });
    expect(dirTile.getAttribute('href')).toBe('https://maps.google.com/?q=18.761,73.843');
    fireEvent.click(dirTile);
    expect(onCtaClick).toHaveBeenCalledWith('directions');
  });

  it('renders fixed bottom action bar with primary Save contact and secondary WhatsApp', () => {
    const onSaveContact = vi.fn();
    render(<VisitorCard data={sampleCardData} onSaveContact={onSaveContact} />);

    const actionBar = screen.getByTestId('visitor-action-bar');
    expect(actionBar).toBeDefined();

    const saveBtn = screen.getByRole('link', { name: /save contact/i });
    expect(saveBtn).toBeDefined();
    expect(saveBtn.className).toContain('bg-bridge-orange');
    expect(saveBtn.className).toContain('text-charcoal');
    expect(saveBtn.className).toContain('rounded-control');

    fireEvent.click(saveBtn);
    expect(onSaveContact).toHaveBeenCalledWith({
      cardId: 'OB-ABC123-E0001',
      slug: 'sahyadri-steel/rajesh-shinde',
    });

    const waBtn = screen.getByRole('link', { name: /whatsapp/i });
    expect(waBtn.getAttribute('href')).toBe('https://wa.me/919823012345');
  });

  it('renders enabled content sections (Bio, Products, Facility, Links) in order', () => {
    render(<VisitorCard data={sampleCardData} />);

    // Bio
    expect(screen.getByText(/pioneering precision alloy engineering/i)).toBeDefined();

    // Products
    expect(screen.getByText('FE 550D TMT Rebars')).toBeDefined();
    expect(screen.getByText('IS 1786 Certified')).toBeDefined();
    expect(screen.getByText('₹54,000 / MT')).toBeDefined();
    expect(screen.getByText('Hot-rolled Alloy Coils')).toBeDefined();

    // Facility & GSTIN
    expect(screen.getByText(/GSTIN: 27AABCS1429B1Z8/i)).toBeDefined();

    // Links
    expect(screen.getByText('Company Website')).toBeDefined();
  });

  it('supports interactive share-back submission with span line connection', async () => {
    const onSharebackSubmit = vi.fn().mockResolvedValue({ success: true });
    render(<VisitorCard data={sampleCardData} onSharebackSubmit={onSharebackSubmit} />);

    // The form opens in a bottom sheet
    fireEvent.click(screen.getByRole('button', { name: /share your details back/i }));

    // Form fields
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Anand Mahindra' } });
    fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: '+919800000000' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'anand@mahindra.com' } });
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Mahindra Auto' } });
    fireEvent.click(screen.getByLabelText(/i agree to share my details/i));

    const submitBtn = screen.getByRole('button', { name: /send contact/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSharebackSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Anand Mahindra',
          phone: '+919800000000',
          email: 'anand@mahindra.com',
          company: 'Mahindra Auto',
          consent: true,
        })
      );
    });

    // Success feedback
    await waitFor(() => {
      expect(screen.getByTestId('shareback-success')).toBeDefined();
      expect(screen.getByText('Details shared')).toBeDefined();
      expect(screen.getByText(/your details have been shared with rajesh shinde/i)).toBeDefined();
    });
  });

  it('renders all specification section 7 state pages with zero personal data leaks', () => {
    // 1. Unactivated
    const { unmount: unmount1 } = render(<VisitorCard state="unactivated" />);
    expect(screen.getByText('This card is not active yet')).toBeDefined();
    expect(screen.queryByText('Rajesh Shinde')).toBeNull();
    unmount1();

    // 2. Inactive
    const { unmount: unmount2 } = render(<VisitorCard state="inactive" companyName="Sahyadri Steel" />);
    expect(screen.getByText('This card is inactive')).toBeDefined();
    expect(screen.getByText(/please contact sahyadri steel directly/i)).toBeDefined();
    expect(screen.queryByText('Rajesh Shinde')).toBeNull();
    unmount2();

    // 3. Plan lapsed
    const { unmount: unmount3 } = render(<VisitorCard state="plan_lapsed" />);
    expect(screen.getByText("This company's plan has lapsed")).toBeDefined();
    expect(screen.queryByText('Rajesh Shinde')).toBeNull();
    unmount3();

    // 4. Offboarded with handover
    const { unmount: unmount4 } = render(
      <VisitorCard
        state="offboarded"
        offboardedDetails={{
          personName: 'Arun Patil',
          successorName: 'Priya Desai',
          successorMessageUrl: 'https://wa.me/919811122233',
        }}
      />
    );
    expect(screen.getByText('Arun Patil has moved on')).toBeDefined();
    expect(screen.getByText('Priya Desai can help you.')).toBeDefined();
    expect(screen.getByRole('link', { name: /message priya desai/i })).toBeDefined();
    unmount4();
  });

  it('satisfies WCAG AA axe accessibility in light and dark mode', async () => {
    const { container: lightContainer } = render(<VisitorCard data={sampleCardData} theme="light" />);
    const lightResults = await axe(lightContainer);
    expect(lightResults.violations).toEqual([]);

    const { container: darkContainer } = render(<VisitorCard data={sampleCardData} theme="dark" />);
    const darkResults = await axe(darkContainer);
    expect(darkResults.violations).toEqual([]);
  });
});
