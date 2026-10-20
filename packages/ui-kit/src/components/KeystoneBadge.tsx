import React from 'react';

export interface KeystoneBadgeProps {
  verified?: boolean;
  language?: 'en' | 'hi';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children?: React.ReactNode;
}

/**
 * Keystone verification badge at the crown of the arch.
 * Meets PRD Section 8.3 and UI/UX Specification Reference Screen 1.
 */
export const KeystoneBadge: React.FC<KeystoneBadgeProps> = ({
  verified = true,
  language = 'en',
  size = 'md',
  className = '',
  children,
}) => {
  if (!verified && !children) return null;

  const label = language === 'hi' ? 'सत्यापित व्यवसाय' : 'Verified business';

  const sizeClasses = {
    sm: 'w-6 h-6 p-1',
    md: 'w-8 h-8 p-1.5',
    lg: 'w-10 h-10 p-2',
  }[size];

  return (
    <div
      className={`relative inline-flex items-center justify-center bg-sand-paper border border-sand-border rounded-arch shadow-sm text-bridge-orange-deep ${sizeClasses} ${className}`}
      title={label}
      role="img"
      aria-label={label}
      data-testid="crown-keystone"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-full h-full text-deep-orange"
        aria-hidden="true"
      >
        {/* Keystone arch trapezoid shape */}
        <path d="M4 4h16l-3 16H7L4 4z" fill="currentColor" fillOpacity="0.15" />
        {/* Verification checkmark inside keystone */}
        <polyline points="9 11 12 14 16 9" stroke="currentColor" className="text-deep-orange" />
      </svg>
      {children ? <span className="ml-1 text-xs font-bold text-charcoal">{children}</span> : <span className="sr-only">{label}</span>}
    </div>
  );
};
