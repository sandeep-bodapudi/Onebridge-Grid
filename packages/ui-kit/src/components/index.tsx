import React from 'react';
import { cn } from './ActionButton';

// Actions
export * from './Button';
export * from './ActionButton';
export * from './IconButton';

// Forms
export * from './FormField';
export * from './Input';
export * from './Select';
export * from './SegmentedControl';
export * from './OtpInput';

// Display
export * from './StatusChip';
export * from './Table';
export * from './Tabs';
export * from './Toast';
export * from './EmptyState';
export * from './Skeleton';

// Overlays
export * from './SlideOverPanel';
export * from './ConfirmDialog';

// Brand & Span Pieces
export * from './SpanLine';
export * from './KeystoneTag';
export * from './StatTile';
export * from './TrendBars';
export * from './CompanyProfilePage';
export * from './QrPreview';
export * from './PhoneFramePreview';
export * from './BusinessIdDisplay';
export * from './KeystoneBadge';

// Layout
export * from './AppShell';

// Formatting helpers
export * from './audit-format';
export * from './visitor-card-templates';

// Domain Features
export * from './OrgStructure';
export * from './SeatsManagement';
export * from './BrandKitManager';
export * from './AuditLogViewer';
export * from './CardEditor';
export * from './NeutralInactivePage';
export * from './QrDownloadModal';
export * from './SourceTagManager';
export * from './VisitorCard';

// Span Panel / Card Container
export interface SpanCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  isLoading?: boolean;
  error?: string;
  isEmpty?: boolean;
  className?: string;
}

export const SpanCard = ({ children, isLoading, error, isEmpty, className, ...props }: SpanCardProps) => {
  if (isLoading) {
    return (
      <div
        className={cn(
          'rounded-panel border border-sand-border dark:border-sand-border/30 bg-sand/30 dark:bg-charcoal/50 animate-pulse motion-reduce:animate-none p-6 min-h-[128px]',
          className
        )}
        {...props}
      />
    );
  }
  if (error) {
    return (
      <div
        className={cn(
          'rounded-panel border border-error/30 bg-error/10 text-error p-6 text-center font-bold text-sm',
          className
        )}
        {...props}
      >
        {error}
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div
        className={cn(
          'rounded-panel border border-sand-border dark:border-sand-border/30 bg-warm-paper dark:bg-charcoal p-6 text-center text-charcoal/50 dark:text-warm-paper/50 font-bold text-sm',
          className
        )}
        {...props}
      >
        Empty
      </div>
    );
  }
  return (
    <div
      className={cn(
        'rounded-panel border border-sand-border dark:border-sand-border/30 bg-warm-paper dark:bg-charcoal shadow-sm p-6',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// Backward-compatible alias for existing imports
export const ArchCard = SpanCard;
export type ArchCardProps = SpanCardProps;

export const QrFrame = ({ children, isLoading, error, isEmpty }: { children?: React.ReactNode; isLoading?: boolean; error?: string; isEmpty?: boolean }) => {
  if (isLoading) return <div className="border border-sand-border p-4 rounded-panel animate-pulse motion-reduce:animate-none bg-sand/30 min-w-[128px] min-h-[128px]" />;
  if (error) return <div className="border border-error/40 p-4 rounded-panel text-error text-center font-bold text-xs">{error}</div>;
  if (isEmpty) return <div className="border border-sand-border p-4 rounded-panel text-center text-charcoal/50 font-bold text-xs">No QR</div>;
  return <div className="border border-sand-border p-4 rounded-panel bg-white">{children}</div>;
};

export const SideDrawer = ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => (
  <div className={cn('fixed inset-y-0 right-0 w-64 bg-warm-paper dark:bg-charcoal-deep border-l border-sand-border dark:border-sand-border/30 shadow-overlay transform transition-transform duration-200 z-40', isOpen ? 'translate-x-0' : 'translate-x-full')}>
    {children}
  </div>
);

export const OfflineBanner = ({ message, className, ...props }: { message: string; className?: string } & React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('bg-warning text-charcoal font-bold p-3 text-center rounded-control text-xs', className)} {...props}>{message}</div>
);

export const UpdateBanner = ({ message }: { message: string }) => (
  <div className="bg-info text-white font-bold p-3 text-center rounded-control text-xs">{message}</div>
);
