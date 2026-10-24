import localFont from 'next/font/local';

export const fontManrope = localFont({
  src: [
    {
      path: '../public/fonts/manrope-regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/manrope-semibold.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../public/fonts/manrope-bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-manrope',
  display: 'swap',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
});

export const fontNoto = localFont({
  src: [
    {
      path: '../public/fonts/noto-sans-devanagari-regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/noto-sans-devanagari-semibold.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../public/fonts/noto-sans-devanagari-bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-noto',
  display: 'swap',
  fallback: ['sans-serif'],
});
