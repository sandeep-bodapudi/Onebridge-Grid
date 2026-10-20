import React from 'react';
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
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                --bg-sand: #FAF7F2;
                --text-charcoal: #1B2A4A;
              }
              @media (prefers-color-scheme: dark) {
                :root {
                  --bg-sand: #121824;
                  --text-charcoal: #FAF7F2;
                }
              }
              body {
                margin: 0;
                padding: 0;
                font-family: Manrope, "Noto Sans Devanagari", system-ui, -apple-system, sans-serif;
                background-color: var(--bg-sand);
                color: var(--text-charcoal);
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: flex-start;
              }
            `,
          }}
        />
      </head>
      <body className="font-body">{children}</body>
    </html>
  );
}
