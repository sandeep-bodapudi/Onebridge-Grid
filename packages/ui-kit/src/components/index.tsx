import React from 'react';
import { cn } from './ActionButton';
export * from './ActionButton';
export * from './BusinessIdDisplay';
export * from './OrgStructure';
export * from './SeatsManagement';
export * from './BrandKitManager';
export * from './AuditLogViewer';
export * from './CardEditor';
export * from './NeutralInactivePage';
export * from './QrDownloadModal';
export * from './SourceTagManager';
export * from './KeystoneBadge';
export * from './VisitorCard';

export const StatusChip = ({ status, children }: { status: 'success'|'warning'|'error'|'info'; children: React.ReactNode }) => {
  return (
    <span className={cn('inline-flex items-center px-12 py-4 rounded-12 font-bold text-sm', {
      'bg-success/10 text-success': status === 'success',
      'bg-warning/10 text-deep-orange': status === 'warning',
      'bg-error/10 text-error': status === 'error',
      'bg-info/10 text-info': status === 'info',
    })}>
      {children}
    </span>
  );
};

export interface ArchCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  isLoading?: boolean;
  error?: string;
  isEmpty?: boolean;
  className?: string;
}

export const ArchCard = ({ children, isLoading, error, isEmpty, className, ...props }: ArchCardProps) => {
  if (isLoading) return <div className={cn("rounded-arch bg-sand/50 dark:bg-charcoal/50 animate-pulse shadow-md p-16 min-h-[128px]", className)} {...props}></div>;
  if (error) return <div className={cn("rounded-arch bg-error/10 text-error shadow-md p-16 text-center font-bold", className)} {...props}>{error}</div>;
  if (isEmpty) return <div className={cn("rounded-arch bg-white dark:bg-charcoal shadow-md p-16 text-center text-charcoal/50 font-bold", className)} {...props}>Empty</div>;
  return <div className={cn("rounded-arch bg-white dark:bg-charcoal shadow-md p-16", className)} {...props}>{children}</div>;
};

export const QrFrame = ({ children, isLoading, error, isEmpty }: { children?: React.ReactNode; isLoading?: boolean; error?: string; isEmpty?: boolean }) => {
  if (isLoading) return <div className="border-4 border-sand-border p-16 rounded-16 animate-pulse bg-sand/50 min-w-[128px] min-h-[128px]"></div>;
  if (error) return <div className="border-4 border-error/50 p-16 rounded-16 text-error text-center font-bold">{error}</div>;
  if (isEmpty) return <div className="border-4 border-sand-border p-16 rounded-16 text-center text-charcoal/50 font-bold">No QR</div>;
  return <div className="border-4 border-sand-border p-16 rounded-16">{children}</div>;
};

export const StatTile = ({ label, value, isLoading, error, isEmpty }: { label: string; value: string; isLoading?: boolean; error?: string; isEmpty?: boolean }) => {
  if (isLoading) return (
    <div className="bg-sand dark:bg-charcoal-deep p-16 rounded-16 animate-pulse">
      <div className="h-4 bg-charcoal/20 rounded w-1/2 mb-8"></div>
      <div className="h-8 bg-charcoal/20 rounded w-3/4"></div>
    </div>
  );
  if (error) return <div className="bg-error/10 text-error p-16 rounded-16 text-sm font-bold">{error}</div>;
  if (isEmpty) return <div className="bg-sand dark:bg-charcoal-deep p-16 rounded-16 text-sm text-charcoal/50 font-bold">No data</div>;
  return (
    <div className="bg-sand dark:bg-charcoal-deep p-16 rounded-16">
      <div className="text-sm font-bold text-charcoal/70 dark:text-warm-paper/70">{label}</div>
      <div className="text-2xl font-extrabold">{value}</div>
    </div>
  );
};

export const SideDrawer = ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => (
  <div className={cn("fixed inset-y-0 right-0 w-64 bg-warm-paper dark:bg-charcoal-deep shadow-lg transform transition-transform", isOpen ? "translate-x-0" : "translate-x-full")}>
    {children}
  </div>
);

export const Toast = ({ message, type = 'info' }: { message: string, type?: 'info'|'error'|'success' }) => (
  <div className={cn("rounded-12 p-16 shadow-md", {
    'bg-info text-white': type === 'info',
    'bg-error text-white': type === 'error',
    'bg-success text-white': type === 'success',
  })}>{message}</div>
);

export const EmptyState = ({ message, className, ...props }: { message: string; className?: string } & React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-32 text-center text-charcoal/50 dark:text-warm-paper/50 font-bold", className)} {...props}>{message}</div>
);

export const OfflineBanner = ({ message, className, ...props }: { message: string; className?: string } & React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("bg-warning text-charcoal font-bold p-8 text-center rounded-12", className)} {...props}>{message}</div>
);

export const UpdateBanner = ({ message }: { message: string }) => (
  <div className="bg-info text-white font-bold p-8 text-center rounded-12">{message}</div>
);
