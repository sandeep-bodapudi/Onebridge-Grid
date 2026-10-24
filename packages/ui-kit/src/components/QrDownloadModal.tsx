import React, { useEffect, useId, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { cn } from './ActionButton';
import { Button } from './Button';

export interface QrDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrId: string;
  sourceLabel: string;
  shortUrl: string;
  onDownload: (options: { format: 'png' | 'svg' | 'pdf'; size: number; template?: 'a4' | 'a5' }) => void;
}

const FORMATS = [
  { value: 'png', label: 'PNG', hint: 'Image for WhatsApp, email and slides' },
  { value: 'svg', label: 'SVG', hint: 'Sharp at any size, for designers and printers' },
  { value: 'pdf', label: 'PDF', hint: 'Ready to print' },
] as const;

const SIZES = [
  { value: 600, label: 'Screen', hint: '600 × 600 px' },
  { value: 1000, label: 'Print', hint: '1000 × 1000 px' },
  { value: 2000, label: 'Large print', hint: '2000 × 2000 px' },
];

/** Download dialog for one QR code: choose a format (and a size for PNG). Escape closes it. */
export const QrDownloadModal: React.FC<QrDownloadModalProps> = ({ isOpen, onClose, sourceLabel, shortUrl, onDownload }) => {
  const [format, setFormat] = useState<'png' | 'svg' | 'pdf'>('png');
  const [size, setSize] = useState(1000);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    triggerRef.current = document.activeElement as HTMLElement;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && dialogRef.current) {
        const items = dialogRef.current.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])');
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      triggerRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-charcoal/60 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full sm:max-w-md bg-warm-paper dark:bg-charcoal text-charcoal dark:text-warm-paper rounded-t-sheet sm:rounded-sheet border border-sand-border dark:border-sand-border/30 shadow-overlay p-6 space-y-5 focus:outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-bold">
              Download branded QR code
            </h2>
            <p className="text-sm text-charcoal/70 dark:text-warm-paper/70 truncate">
              {sourceLabel} · <span className="font-mono text-xs">{shortUrl}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-control hover:bg-sand dark:hover:bg-charcoal-deep"
            aria-label="Close"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold mb-2">Format</legend>
          {FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={format === f.value}
              aria-label={`${f.label}: ${f.hint}`}
              onClick={() => setFormat(f.value)}
              className={cn(
                'w-full flex items-center justify-between gap-3 min-h-[52px] px-4 rounded-panel border text-left transition-colors',
                format === f.value
                  ? 'border-charcoal bg-sand/50 dark:border-warm-paper dark:bg-charcoal-deep'
                  : 'border-sand-border hover:bg-sand/30 dark:border-sand-border/30 dark:hover:bg-charcoal-deep/50'
              )}
            >
              <span className="text-sm font-bold">{f.label}</span>
              <span className="text-sm text-charcoal/70 dark:text-warm-paper/70">{f.hint}</span>
            </button>
          ))}
        </fieldset>

        {format === 'png' ? (
          <fieldset>
            <legend className="text-sm font-semibold mb-2">Size</legend>
            <div className="grid grid-cols-3 gap-2">
              {SIZES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={size === s.value}
                  onClick={() => setSize(s.value)}
                  className={cn(
                    'min-h-[56px] px-2 rounded-panel border text-center transition-colors',
                    size === s.value
                      ? 'border-charcoal bg-sand/50 dark:border-warm-paper dark:bg-charcoal-deep'
                      : 'border-sand-border hover:bg-sand/30 dark:border-sand-border/30'
                  )}
                >
                  <span className="block text-sm font-bold">{s.label}</span>
                  <span className="block text-xs text-charcoal/60 dark:text-warm-paper/60">{s.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="gap-2"
            onClick={() => {
              onDownload({ format, size: format === 'png' ? size : 1000 });
              onClose();
            }}
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Download file
          </Button>
        </div>
      </div>
    </div>
  );
};
