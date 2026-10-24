import React, { useEffect, useId, useRef } from 'react';
import { cn } from './ActionButton';
import { Button } from './Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  itemName: string;
  explanation?: string;
  confirmLabel: string; // Must be an active verb, e.g. "Offboard employee", "Disable QR"
  isDestructive?: boolean;
  isLoading?: boolean;
  className?: string;
}

/**
 * ConfirmDialog: Accessible confirmation modal dialog.
 * - Enforces focus trap
 * - Escape key to dismiss
 * - Restores focus to trigger on close
 * - Explicitly names the target item
 * - Uses active destructive verb on action button
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName,
  explanation,
  confirmLabel,
  isDestructive = true,
  isLoading = false,
  className,
}) => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
      dialogRef.current?.focus();
    } else if (triggerRef.current) {
      triggerRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn(
          'w-full max-w-md bg-warm-paper dark:bg-charcoal border border-sand-border dark:border-sand-border/30 rounded-sheet shadow-overlay p-6 flex flex-col gap-4 focus:outline-none animate-in fade-in zoom-in-95 duration-150',
          className
        )}
      >
        <h3 id={titleId} className="font-body text-base font-bold text-charcoal dark:text-warm-paper">
          {title}
        </h3>

        <div className="text-sm text-charcoal/80 dark:text-warm-paper/80 leading-relaxed">
          This affects <strong className="text-charcoal dark:text-warm-paper">{itemName}</strong>.
        </div>

        {explanation && (
          <div className="p-3 bg-sand/40 dark:bg-charcoal-deep/50 border-l-2 border-bridge-orange text-xs text-charcoal/70 dark:text-warm-paper/70 leading-normal">
            {explanation}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-2">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant={isDestructive ? 'destructive' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
