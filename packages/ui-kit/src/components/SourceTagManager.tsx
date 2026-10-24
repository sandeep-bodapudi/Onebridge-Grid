import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, Plus, QrCode, WifiOff } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { StatusChip } from './StatusChip';
import { Skeleton } from './Skeleton';
import { SlideOverPanel } from './SlideOverPanel';
import { ConfirmDialog } from './ConfirmDialog';
import { QrDownloadModal } from './QrDownloadModal';

export interface ShortLinkItem {
  id: string;
  code: string;
  shortUrl: string;
  source: string;
  label?: string;
  destinationUrl: string;
  status: 'active' | 'disabled' | 'unactivated' | 'pending_approval';
  isExternal?: boolean;
}

export interface SourceTagManagerProps {
  cardId: string;
  cardName?: string;
  items: ShortLinkItem[];
  isLoading?: boolean;
  error?: string | null;
  isOffline?: boolean;
  onCreateTag: (data: { source: string; label?: string; destinationUrl?: string }) => Promise<void>;
  onUpdateTag?: (id: string, data: { destinationUrl?: string; label?: string; status?: 'active' | 'disabled' }) => Promise<void>;
  onDownloadAsset: (qrId: string, format: 'png' | 'svg' | 'pdf', size: number, template?: 'a4' | 'a5') => void;
  /** Returns an image URL (e.g. an object URL) for the QR preview. */
  getPreviewImage?: (qrId: string) => Promise<string>;
  isAdmin?: boolean;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

const statusText: Record<ShortLinkItem['status'], { label: string; variant: 'success' | 'archived' | 'info' | 'warning' }> = {
  active: { label: 'Active', variant: 'success' },
  disabled: { label: 'Disabled', variant: 'archived' },
  unactivated: { label: 'Not active yet', variant: 'info' },
  pending_approval: { label: 'Waiting for approval', variant: 'warning' },
};

const CopyButton: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      className="gap-1.5"
      aria-label={copied ? 'Copied' : `Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard?.writeText(value);
        } catch {
          // Clipboard can be refused; the link stays visible and selectable.
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
      <span className="text-sm">{copied ? 'Copied' : 'Copy'}</span>
    </Button>
  );
};

export const SourceTagManager: React.FC<SourceTagManagerProps> = ({
  cardName = 'this card',
  items,
  isLoading = false,
  error = null,
  isOffline = false,
  onCreateTag,
  onUpdateTag,
  onDownloadAsset,
  getPreviewImage,
  isAdmin = false,
}) => {
  const [createOpen, setCreateOpen] = useState(false);
  const [labelInput, setLabelInput] = useState('');
  const [sourceInput, setSourceInput] = useState('');
  const [sourceEdited, setSourceEdited] = useState(false);
  const [destInput, setDestInput] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [downloadItem, setDownloadItem] = useState<ShortLinkItem | null>(null);
  const [disableItem, setDisableItem] = useState<ShortLinkItem | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const primary = items.find((i) => i.source === 'default') || items[0];
  const others = items.filter((i) => i !== primary);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    if (primary && getPreviewImage) {
      getPreviewImage(primary.id)
        .then((url) => {
          if (!cancelled) setPreview(url);
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [primary?.id, getPreviewImage]);

  const resetForm = () => {
    setLabelInput('');
    setSourceInput('');
    setSourceEdited(false);
    setDestInput('');
    setCreateError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const source = (sourceInput || slugify(labelInput)).trim();
    if (!labelInput.trim() && !source) {
      setCreateError('Say where people will scan this QR code, for example "Pune expo stall".');
      return;
    }
    if (destInput && !/^https:\/\/\S+$/.test(destInput.trim())) {
      setCreateError('Use a link that starts with https://');
      return;
    }
    setSubmitting(true);
    setCreateError(null);
    try {
      await onCreateTag({ source, label: labelInput.trim() || undefined, destinationUrl: destInput.trim() || undefined });
      resetForm();
      setCreateOpen(false);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Could not create the QR code. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const nameOf = (item: ShortLinkItem) => item.label || (item.source === 'default' ? 'Main card QR' : item.source.replace(/_/g, ' '));

  return (
    <div className="space-y-5 text-charcoal dark:text-warm-paper">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-bold">QR codes and links</h3>
          <p className="text-sm text-charcoal/70 dark:text-warm-paper/70">
            Every scan opens the card for {cardName}. Make a separate QR for each event or place to see where leads come from.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setCreateOpen(true)} className="gap-2 self-start sm:self-auto" data-testid="add-qr-button">
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add QR for an event or place
        </Button>
      </div>

      {isOffline ? (
        <div role="status" className="flex items-center gap-3 px-4 py-3 rounded-panel border border-warning/40 bg-warning/10 text-sm">
          <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
          You are currently offline. Changes will sync when reconnected.
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="px-4 py-3 rounded-panel border border-error/40 bg-error/10 text-sm">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid sm:grid-cols-[180px_1fr] gap-5" aria-busy="true">
          <div className="w-[180px] h-[180px] bg-sand dark:bg-charcoal rounded-panel animate-pulse motion-reduce:animate-none" />
          <div className="space-y-3">
            <Skeleton width="60%" height={20} />
            <Skeleton height={44} />
            <Skeleton width="40%" height={44} />
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-2 px-6 py-8 rounded-panel border border-dashed border-sand-border dark:border-sand-border/30">
          <QrCode className="w-6 h-6 text-charcoal/40 dark:text-warm-paper/40" aria-hidden="true" />
          <p className="text-sm font-bold">No QR tags created yet</p>
          <p className="text-sm text-charcoal/70 dark:text-warm-paper/70">Publish the card to get its main QR code.</p>
        </div>
      ) : (
        <>
          {primary ? (
            <div className="grid sm:grid-cols-[180px_minmax(0,1fr)] gap-5 items-start" data-testid="primary-qr">
              <div className="w-[180px] h-[180px] p-3 bg-white rounded-panel border border-sand-border flex items-center justify-center">
                {preview ? (
                  <img src={preview} alt={`QR code for ${cardName}`} className="w-full h-full object-contain" />
                ) : (
                  <QrCode className="w-12 h-12 text-charcoal/30" aria-label="QR code loading" />
                )}
              </div>
              <div className="space-y-3 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold">{nameOf(primary)}</span>
                  <StatusChip status={statusText[primary.status].variant}>{statusText[primary.status].label}</StatusChip>
                </div>
                <div className="flex items-center gap-1 rounded-control border border-sand-border dark:border-sand-border/30 bg-sand/30 dark:bg-charcoal-deep/40 pl-3 min-w-0">
                  <span className="font-mono text-sm truncate select-all flex-1 min-w-0">{primary.shortUrl}</span>
                  <CopyButton value={primary.shortUrl} label="short link" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" className="gap-2" onClick={() => onDownloadAsset(primary.id, 'png', 1000)}>
                    <Download className="w-4 h-4" aria-hidden="true" />
                    Download PNG
                  </Button>
                  <Button variant="secondary" onClick={() => setDownloadItem(primary)}>
                    More formats
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {others.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-sm font-bold">Event and place QR codes</h4>
              <ul className="rounded-panel border border-sand-border dark:border-sand-border/30 divide-y divide-sand-border dark:divide-sand-border/30 overflow-hidden">
                {others.map((item) => (
                  <li key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 bg-warm-paper dark:bg-charcoal">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold">{nameOf(item)}</span>
                        <StatusChip status={statusText[item.status].variant}>{statusText[item.status].label}</StatusChip>
                      </div>
                      <div className="font-mono text-xs text-charcoal/60 dark:text-warm-paper/60 truncate">{item.shortUrl}</div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <CopyButton value={item.shortUrl} label={`link for ${nameOf(item)}`} />
                      <Button variant="ghost" className="gap-1.5" onClick={() => setDownloadItem(item)}>
                        <Download className="w-4 h-4" aria-hidden="true" />
                        <span className="text-sm">Download QR</span>
                      </Button>
                      {onUpdateTag && isAdmin ? (
                        item.status === 'disabled' ? (
                          <Button variant="ghost" onClick={() => onUpdateTag(item.id, { status: 'active' })}>
                            Turn on
                          </Button>
                        ) : (
                          <Button variant="ghost" onClick={() => setDisableItem(item)}>
                            Disable
                          </Button>
                        )
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}

      <SlideOverPanel
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false);
          resetForm();
        }}
        title="Add QR for an event or place"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="create-qr-form" isLoading={submitting}>
              Create QR tag
            </Button>
          </>
        }
      >
        <form id="create-qr-form" onSubmit={handleCreate} noValidate className="space-y-4">
          <p className="text-sm text-charcoal/70 dark:text-warm-paper/70">
            It opens the same card. Leads from it are tagged with this name, so you can tell which stall or brochure worked.
          </p>
          {createError ? (
            <p role="alert" className="text-sm text-error">
              {createError}
            </p>
          ) : null}
          <div className="space-y-1">
            <label htmlFor="qr-label" className="block text-sm font-semibold">
              Where will people scan it?
            </label>
            <Input
              id="qr-label"
              placeholder="Exhibition Hall B stall, Expo 2026"
              value={labelInput}
              onChange={(e) => {
                setLabelInput(e.target.value);
                if (!sourceEdited) setSourceInput(slugify(e.target.value));
              }}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="qr-source" className="block text-sm font-semibold">
              Tag shown on leads
            </label>
            <Input
              id="qr-source"
              placeholder="expo_2026_hall_b"
              className="font-mono"
              value={sourceInput}
              onChange={(e) => {
                setSourceEdited(true);
                setSourceInput(e.target.value);
              }}
            />
            <p className="text-xs text-charcoal/60 dark:text-warm-paper/60">Filled in for you from the name. Letters, numbers and underscores.</p>
          </div>
          <div className="space-y-1">
            <label htmlFor="qr-dest" className="block text-sm font-semibold">
              Open a different page <span className="font-normal text-charcoal/60 dark:text-warm-paper/60">(optional)</span>
            </label>
            <Input id="qr-dest" type="url" placeholder="https://" value={destInput} onChange={(e) => setDestInput(e.target.value)} />
            <p className="text-xs text-charcoal/60 dark:text-warm-paper/60">Leave empty to open the card. Pages outside OneBridge need admin approval.</p>
          </div>
        </form>
      </SlideOverPanel>

      {downloadItem ? (
        <QrDownloadModal
          isOpen
          onClose={() => setDownloadItem(null)}
          qrId={downloadItem.id}
          sourceLabel={nameOf(downloadItem)}
          shortUrl={downloadItem.shortUrl}
          onDownload={(opts) => onDownloadAsset(downloadItem.id, opts.format, opts.size, opts.template)}
        />
      ) : null}

      <ConfirmDialog
        isOpen={Boolean(disableItem)}
        onClose={() => setDisableItem(null)}
        onConfirm={async () => {
          if (disableItem && onUpdateTag) await onUpdateTag(disableItem.id, { status: 'disabled' });
          setDisableItem(null);
        }}
        title={`Disable ${disableItem ? nameOf(disableItem) : 'this QR code'}?`}
        itemName={disableItem ? `${nameOf(disableItem)} (${disableItem.shortUrl})` : ''}
        explanation="People who scan it will see a neutral 'link inactive' page. Printed copies stop working until you turn it back on."
        confirmLabel="Disable QR"
      />
    </div>
  );
};

