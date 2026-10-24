// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react';
import { axe } from 'jest-axe';
import React from 'react';
import { KeystoneBadge } from '../src/components/KeystoneBadge';
import { VisitorCard, VisitorCardProps } from '../src/components/VisitorCard';

/** Share-back lives in a bottom sheet (D-UI-REDESIGN); open it before using the form. */
function openShareSheet() {
  fireEvent.click(screen.getByRole('button', { name: /share your details back/i }));
}

describe('F12: Visitor Card UI Component', () => {
  const publishedCardData: VisitorCardProps['data'] = {
    cardId: 'OB-ABC123-E0001',
    slug: 'acme-steels/sneha-reddy',
    status: 'published',
    templateId: 'classic-charcoal',
    language: 'en',
    verifiedBadge: true,
    person: {
      name: 'Sneha Reddy',
      designation: 'Senior Sales Executive',
      photoUrl: 'https://cdn.onebridge.in/photos/sneha.jpg',
      phone: '+919876543210',
      email: 'sneha@acmesteels.com',
      bio: "Hyderabad's supplier of TMT bars and coated coils to builders and dealers.",
    },
    company: {
      id: 'org_acme',
      businessId: 'OB-ABC123',
      name: 'Acme Steels',
      logoUrl: 'https://cdn.onebridge.in/logos/acme.png',
      brandColours: {
        band: '#1B2A4A',
        accent: '#F68713',
        text: '#FFFFFF',
      },
    },
    branch: {
      id: 'branch_hq',
      name: 'Headquarters Branch',
      address: 'Road No. 36, Jubilee Hills, Hyderabad',
      mapPin: { lat: 17.432, lng: 78.407 },
    },
    sections: [
      {
        type: 'about',
        order: 0,
        content: { text: 'Supplying certified high-tensile steel across Telangana.' },
      },
      {
        type: 'products',
        order: 1,
        content: { items: [{ name: 'Fe-550D TMT Bars', description: 'Earthquake resistant' }] },
      },
    ],
    actions: {
      saveContactUrl: '/c/acme-steels/sneha-reddy/vcard',
      whatsappUrl: 'https://wa.me/919876543210?text=Hi%20Sneha%2C%20I%20came%20across%20your%20digital%20card',
      callUrl: 'tel:+919876543210',
      emailUrl: 'mailto:sneha@acmesteels.com',
      directionsUrl: 'https://www.google.com/maps/search/?api=1&query=17.432,78.407',
    },
  };

  describe('KeystoneBadge', () => {
    it('renders keystone verification badge with accessible tooltip and contrast', () => {
      render(<KeystoneBadge verified={true} />);
      const badge = screen.getByRole('img', { name: /verified business/i });
      expect(badge).toBeDefined();
    });

    it('renders Hindi screen reader label when language is hi', () => {
      render(<KeystoneBadge verified={true} language="hi" />);
      const badge = screen.getByRole('img', { name: /सत्यापित व्यवसाय/i });
      expect(badge).toBeDefined();
    });
  });

  describe('AC-1: Layout per Reference Screen 1', () => {
    // D-UI-REDESIGN: the arch header and keystone crown became a straight brand band with a span line and a keystone tag.
    it('renders the brand header, logo, photo, name, designation, company, branch and verified tag', () => {
      render(<VisitorCard data={publishedCardData} />);

      expect(screen.getByTestId('card-header')).toBeDefined();
      expect(screen.getByAltText(/acme steels logo/i)).toBeDefined();
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sneha Reddy');
      expect(screen.getByText('Senior Sales Executive')).toBeDefined();
      expect(screen.getByText(/Acme Steels · Headquarters Branch/)).toBeDefined();

      const photo = screen.getByAltText(/sneha reddy/i);
      expect(photo.getAttribute('src')).toBe('https://cdn.onebridge.in/photos/sneha.jpg');

      expect(screen.getByTestId('verified-tag')).toBeDefined();
      expect(screen.getByRole('img', { name: /verified business/i })).toBeDefined();
    });

    it('never truncates the name and puts readable text on the brand band', () => {
      render(<VisitorCard data={{ ...publishedCardData!, templateId: 'bridge-orange' }} />);
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading.className).not.toContain('truncate');
      // Orange is a fill, never under white text (AGENTS.md).
      expect(heading.parentElement?.className).toContain('text-charcoal');
    });

    it('shows only the contact tiles that have a target, sized equally', () => {
      render(<VisitorCard data={{ ...publishedCardData!, actions: { ...publishedCardData!.actions, directionsUrl: undefined } }} />);
      const nav = screen.getByRole('navigation', { name: /quick contact actions/i });
      expect(nav.querySelectorAll('a')).toHaveLength(2);
      expect((nav as HTMLElement).style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
    });
  });

  describe('AC-2: Save Contact & vCard Download', () => {
    it('renders primary Save Contact button with vCard href and calls onSaveContact telemetry', () => {
      const onSaveContact = vi.fn();
      render(<VisitorCard data={publishedCardData} onSaveContact={onSaveContact} />);

      const saveBtn = screen.getByRole('link', { name: /save contact/i });
      expect(saveBtn).toBeDefined();
      expect(saveBtn.getAttribute('href')).toBe('/c/acme-steels/sneha-reddy/vcard');

      fireEvent.click(saveBtn);
      expect(onSaveContact).toHaveBeenCalledWith({ cardId: 'OB-ABC123-E0001', slug: 'acme-steels/sneha-reddy' });
    });
  });

  describe('AC-3: WhatsApp, Call, Email, and Directions', () => {
    it('renders WhatsApp with prefilled greeting, Call, Email, and Directions with telemetry callback', () => {
      const onCtaClick = vi.fn();
      render(<VisitorCard data={publishedCardData} onCtaClick={onCtaClick} />);

      const waBtn = screen.getByRole('link', { name: /whatsapp/i });
      expect(waBtn.getAttribute('href')).toContain('https://wa.me/919876543210');
      fireEvent.click(waBtn);
      expect(onCtaClick).toHaveBeenCalledWith('whatsapp');

      const callBtn = screen.getByRole('link', { name: /call/i });
      expect(callBtn.getAttribute('href')).toBe('tel:+919876543210');
      fireEvent.click(callBtn);
      expect(onCtaClick).toHaveBeenCalledWith('call');

      const emailBtn = screen.getByRole('link', { name: /email/i });
      expect(emailBtn.getAttribute('href')).toBe('mailto:sneha@acmesteels.com');
      fireEvent.click(emailBtn);
      expect(onCtaClick).toHaveBeenCalledWith('email');

      const dirBtn = screen.getByRole('link', { name: /directions/i });
      expect(dirBtn.getAttribute('href')).toContain('https://www.google.com/maps');
      fireEvent.click(dirBtn);
      expect(onCtaClick).toHaveBeenCalledWith('directions');
    });
  });

  describe('AC-5: Hindi Toggle & Dark/Light System Setting', () => {
    it('toggles language between English and Hindi dynamically', () => {
      render(<VisitorCard data={publishedCardData} />);

      // Initially in English
      expect(screen.getByRole('link', { name: /save contact/i })).toBeDefined();

      const toggle = screen.getByTestId('language-toggle');
      fireEvent.click(toggle);

      // Switched to Hindi
      expect(screen.getByRole('link', { name: /संपर्क सहेजें/i })).toBeDefined();
      expect(screen.getByText(/अपना विवरण साझा करें/i)).toBeDefined();

      // Toggle back
      fireEvent.click(toggle);
      expect(screen.getByRole('link', { name: /save contact/i })).toBeDefined();
    });

    it('respects system dark mode by applying dark theme classes', () => {
      const { container } = render(<VisitorCard data={publishedCardData} theme="dark" />);
      const darkContainer = container.querySelector('.theme-dark');
      expect(darkContainer).not.toBeNull();
      expect(darkContainer?.classList.contains('bg-charcoal-deep')).toBe(true);
    });
  });

  describe('AC-7: All UI States per Specification Section 7', () => {
    it('renders the loading skeleton', () => {
      render(<VisitorCard state="loading" />);
      expect(screen.getByTestId('visitor-card-skeleton')).toBeDefined();
    });

    it('renders unactivated NFC card state with zero personal data', () => {
      render(<VisitorCard state="unactivated" />);
      expect(screen.getByText('This card is not active yet')).toBeDefined();
      expect(screen.getByText(/tap it on your own phone while signed in to activate it/i)).toBeDefined();
      // Ensure zero personal identifiers are rendered
      expect(screen.queryByText('Sneha Reddy')).toBeNull();
      expect(screen.queryByText('+919876543210')).toBeNull();
    });

    it('renders inactive or lost card state with zero personal data', () => {
      render(<VisitorCard state="inactive" companyName="Acme Steels" />);
      expect(screen.getByText('This card is inactive')).toBeDefined();
      expect(screen.getByText(/please contact acme steels directly\. no personal details are shown\./i)).toBeDefined();
      expect(screen.queryByText('Sneha Reddy')).toBeNull();
      expect(screen.queryByText('+919876543210')).toBeNull();
    });

    it('renders offboarded employee state with successor message button', () => {
      render(
        <VisitorCard
          state="offboarded"
          offboardedDetails={{
            personName: 'Rajesh Iyer',
            successorName: 'Sneha Reddy',
            successorMessageUrl: 'https://wa.me/919876543210',
          }}
        />
      );
      expect(screen.getByText('Rajesh Iyer has moved on')).toBeDefined();
      expect(screen.getByText('Sneha Reddy can help you.')).toBeDefined();
      const messageBtn = screen.getByRole('link', { name: /message sneha/i });
      expect(messageBtn.getAttribute('href')).toBe('https://wa.me/919876543210');
    });

    it('renders slow connection warning banner while preserving card details', () => {
      render(<VisitorCard data={publishedCardData} isSlowConnection={true} />);
      expect(screen.getByText(/slow connection/i)).toBeDefined();
      expect(screen.getByText('Sneha Reddy')).toBeDefined();
    });
  });

  describe('AC-8 & F13: Interactive Share-Back Panel Container', () => {
    it('keeps the form closed until the visitor asks, then shows every field and the privacy link', () => {
      render(<VisitorCard data={publishedCardData} />);
      expect(screen.getByTestId('shareback-panel')).toBeDefined();
      expect(screen.queryByLabelText(/your name/i)).toBeNull();
      openShareSheet();
      expect(screen.getByRole('dialog', { name: 'Share your details' })).toBeDefined();
      expect(screen.getByLabelText(/your name/i)).toBeDefined();
      expect(screen.getByLabelText(/mobile number/i)).toBeDefined();
      expect(screen.getByLabelText(/email address/i)).toBeDefined();
      expect(screen.getByLabelText(/company name/i)).toBeDefined();
      expect(screen.getByLabelText(/add a quick note/i)).toBeDefined();
      expect(screen.getByLabelText(/i agree to share my details/i)).toBeDefined();

      const privacyLink = screen.getByRole('link', { name: /privacy notice/i });
      expect(privacyLink).toBeDefined();
      expect(privacyLink.getAttribute('href')).toBe('/privacy');
    });

    it('validates required fields (name, phone, consent) before submit (AC-1)', async () => {
      const onSharebackSubmit = vi.fn();
      render(<VisitorCard data={publishedCardData} onSharebackSubmit={onSharebackSubmit} />);
      openShareSheet();

      const submitBtn = screen.getByRole('button', { name: /send contact/i });

      // 1. Submit empty -> error for name
      fireEvent.click(submitBtn);
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/please enter your name/i)).toBeDefined();
      expect(onSharebackSubmit).not.toHaveBeenCalled();

      // 2. Fill name -> error for phone
      fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ravi Kumar' } });
      fireEvent.click(submitBtn);
      expect(screen.getByText(/please enter a valid mobile number/i)).toBeDefined();
      expect(onSharebackSubmit).not.toHaveBeenCalled();

      // 3. Fill phone -> error for consent
      fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: '+919123456789' } });
      fireEvent.click(submitBtn);
      expect(screen.getByText(/you must agree to share your details/i)).toBeDefined();
      expect(onSharebackSubmit).not.toHaveBeenCalled();
    });

    it('submits valid share-back and shows the span connection confirmation (AC-2, AC-7)', async () => {
      const onSharebackSubmit = vi.fn().mockResolvedValue({ success: true });
      render(
        <VisitorCard
          data={publishedCardData}
          onSharebackSubmit={onSharebackSubmit}
          source="qr"
          sourceTag="brochure"
        />
      );
      openShareSheet();

      fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ravi Kumar' } });
      fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: '+919123456789' } });
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'ravi@example.com' } });
      fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Apex Infra' } });
      fireEvent.change(screen.getByLabelText(/add a quick note/i), { target: { value: 'Interested in Fe-550D TMT bars' } });
      fireEvent.click(screen.getByLabelText(/i agree to share my details/i));

      const submitBtn = screen.getByRole('button', { name: /send contact/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSharebackSubmit).toHaveBeenCalledWith({
          name: 'Ravi Kumar',
          phone: '+919123456789',
          email: 'ravi@example.com',
          company: 'Apex Infra',
          note: 'Interested in Fe-550D TMT bars',
          consent: true,
          source: 'qr',
          sourceTag: 'brochure',
        });
      });

      // Confirmation with the span connection animation (a fade under reduced motion, tokens.css)
      await waitFor(() => {
        const successState = screen.getByTestId('shareback-success');
        expect(successState.querySelector('.animate-span-fill')).not.toBeNull();
        expect(screen.getByText(/details shared/i)).toBeDefined();
        expect(screen.getByText(/your details have been shared with sneha reddy/i)).toBeDefined();
      });

      // Dismiss resets back to form
      const dismissBtn = screen.getByTestId('shareback-dismiss');
      fireEvent.click(dismissBtn);
      expect(screen.queryByTestId('shareback-success')).toBeNull();
      expect(screen.getByRole('button', { name: /send contact/i })).toBeDefined();
    });

    it('keeps the confirmation on screen until the visitor closes it (AC-7: clear confirmation)', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      try {
        const onSharebackSubmit = vi.fn().mockResolvedValue({ success: true });
        render(<VisitorCard data={publishedCardData} onSharebackSubmit={onSharebackSubmit} />);
        openShareSheet();

        fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ravi Kumar' } });
        fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: '+919123456789' } });
        fireEvent.click(screen.getByLabelText(/i agree to share my details/i));
        fireEvent.click(screen.getByRole('button', { name: /send contact/i }));

        await act(async () => {
          await vi.advanceTimersByTimeAsync(10);
        });
        expect(screen.getByTestId('shareback-success')).toBeDefined();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(10000);
        });
        expect(screen.getByTestId('shareback-success')).toBeDefined();

        fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
        expect(screen.queryByRole('dialog')).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('closes the sheet with Escape', () => {
      render(<VisitorCard data={publishedCardData} />);
      openShareSheet();
      expect(screen.getByRole('dialog')).toBeDefined();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('displays error banner if submission fails or rate limited', async () => {
      const onSharebackSubmit = vi.fn().mockResolvedValue({
        success: false,
        message: 'Too many submissions. Please try again later.',
      });
      render(<VisitorCard data={publishedCardData} onSharebackSubmit={onSharebackSubmit} />);
      openShareSheet();

      fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ravi Kumar' } });
      fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: '+919123456789' } });
      fireEvent.click(screen.getByLabelText(/i agree to share my details/i));

      fireEvent.click(screen.getByRole('button', { name: /send contact/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText(/too many submissions/i)).toBeDefined();
      });
    });

    it('displays offline error banner when navigator is offline', async () => {
      const onSharebackSubmit = vi.fn();
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      render(<VisitorCard data={publishedCardData} onSharebackSubmit={onSharebackSubmit} />);
      openShareSheet();

      fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ravi Kumar' } });
      fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: '+919123456789' } });
      fireEvent.click(screen.getByLabelText(/i agree to share my details/i));

      fireEvent.click(screen.getByRole('button', { name: /send contact/i }));

      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/you are currently offline/i)).toBeDefined();
      expect(onSharebackSubmit).not.toHaveBeenCalled();

      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    });
  });

  describe('Accessibility (WCAG AA via axe)', () => {
    it('satisfies axe accessibility rules on published card', async () => {
      const { container } = render(<VisitorCard data={publishedCardData} />);
      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });

    it.each([
      'classic-charcoal',
      'bridge-orange',
      'arch-minimal',
      'keystone-dark',
      'paper-light',
      'enterprise-blue',
      'grid-mono',
      'sand-warm',
    ])('renders template %s with its own look and no axe violations', async (templateId) => {
      const { container, getByTestId } = render(<VisitorCard data={{ ...publishedCardData, templateId }} />);
      expect(getByTestId('card-frame').getAttribute('data-template')).toBe(templateId);
      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });

    it('satisfies axe accessibility rules on inactive and unactivated states', async () => {
      const { container: unactivatedContainer } = render(<VisitorCard state="unactivated" />);
      const unactivatedResults = await axe(unactivatedContainer);
      expect(unactivatedResults.violations).toEqual([]);

      const { container: inactiveContainer } = render(<VisitorCard state="inactive" companyName="Acme Steels" />);
      const inactiveResults = await axe(inactiveContainer);
      expect(inactiveResults.violations).toEqual([]);
    });

    it('satisfies axe with the share-back sheet open', async () => {
      const { container } = render(<VisitorCard data={publishedCardData} />);
      openShareSheet();
      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });

    it('renders a not-found state with no personal data', () => {
      render(<VisitorCard state="not_found" />);
      expect(screen.getByText('This card link does not exist')).toBeDefined();
      expect(screen.queryByText('Sneha Reddy')).toBeNull();
    });
  });
});
