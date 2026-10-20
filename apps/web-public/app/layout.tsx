import React from 'react';
import '@onebridge/ui-kit/src/styles/tokens.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'OneBridge Grid | Verified Digital Business Card',
  description: 'Instant verified digital business identity platform for Indian businesses.',
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      </head>
      <body className="min-h-screen flex flex-col items-center bg-warm-paper text-charcoal font-body antialiased dark:bg-charcoal-deep dark:text-warm-paper">
        {children}
      </body>
    </html>
  );
}
