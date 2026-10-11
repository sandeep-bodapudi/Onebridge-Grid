import React from 'react';

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
    <html lang="en">
      <body style={{ margin: 0, padding: 0, fontFamily: 'system-ui, sans-serif', backgroundColor: '#F8F9FA' }}>
        {children}
      </body>
    </html>
  );
}
