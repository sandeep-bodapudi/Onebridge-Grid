import React from 'react';
import '@onebridge/ui-kit/src/styles/tokens.css';
import { fontManrope, fontNoto } from './fonts';

export const metadata = {
  title: 'OneBridge Grid',
  description: 'Digital Business Identity Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fontManrope.variable} ${fontNoto.variable}`}>
      <body className="min-h-screen bg-warm-paper text-charcoal font-body antialiased dark:bg-charcoal-deep dark:text-warm-paper">
        {children}
      </body>
    </html>
  );
}
