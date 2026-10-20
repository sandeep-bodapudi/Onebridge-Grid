import React, { useState } from 'react';
import { ActionButton } from './ActionButton';
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
  isAdmin?: boolean;
}

export const SourceTagManager: React.FC<SourceTagManagerProps> = ({
  cardId: _cardId,
  cardName = 'Digital card',
  items,
  isLoading = false,
  error = null,
  isOffline = false,
  onCreateTag,
  onUpdateTag,
  onDownloadAsset,
  isAdmin = false,
}) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [sourceInput, setSourceInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [destInput, setDestInput] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Download modal state
  const [selectedDownloadItem, setSelectedDownloadItem] = useState<ShortLinkItem | null>(null);

  const handleCopy = (code: string, url: string) => {
    navigator.clipboard?.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceInput.trim()) {
      setCreateError('Please enter a source tag name');
      return;
    }

    try {
      setIsSubmitting(true);
      setCreateError(null);
      await onCreateTag({
        source: sourceInput.trim(),
        label: labelInput.trim() || undefined,
        destinationUrl: destInput.trim() || undefined,
      });
      setSourceInput('');
      setLabelInput('');
      setDestInput('');
      setIsCreateOpen(false);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create source tag');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full font-sans">
      {/* Offline Alert */}
      {isOffline && (
        <div className="bg-warning text-charcoal font-bold p-12 text-center rounded-12 mb-16 text-sm" role="alert">
          You are currently offline. Changes will sync when reconnected.
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-16 mb-24 pb-16 border-b border-sand-border">
        <div>
          <h2 className="text-xl font-bold text-charcoal">
            QR codes & source tags
          </h2>
          <p className="text-xs text-charcoal/60 mt-2">
            Track scan attribution across physical standees, brochures, and events for {cardName}.
          </p>
        </div>
        <ActionButton
          variant="primary"
          onClick={() => setIsCreateOpen(true)}
          className="min-h-[44px] self-start sm:self-auto"
        >
          + Add new QR tag
        </ActionButton>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="bg-error/10 text-error p-16 rounded-12 text-sm font-bold mb-16" role="alert">
          {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-12">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-sand/40 border border-sand-border rounded-16 p-20 animate-pulse flex justify-between items-center">
              <div className="space-y-8 w-1/3">
                <div className="h-4 bg-charcoal/20 rounded w-3/4"></div>
                <div className="h-3 bg-charcoal/10 rounded w-1/2"></div>
              </div>
              <div className="h-8 bg-charcoal/20 rounded w-24"></div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && items.length === 0 && (
        <div className="bg-white border border-sand-border rounded-arch p-40 text-center">
          <div className="w-48 h-48 mx-auto mb-16 rounded-full bg-sand/60 flex items-center justify-center text-charcoal/50">
            <svg className="w-24 h-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <rect x="3" y="3" width="7" height="7" strokeWidth="2" rx="1" />
              <rect x="14" y="3" width="7" height="7" strokeWidth="2" rx="1" />
              <rect x="3" y="14" width="7" height="7" strokeWidth="2" rx="1" />
              <rect x="14" y="14" width="7" height="7" strokeWidth="2" rx="1" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-charcoal mb-4">No QR tags created yet</h3>
          <p className="text-xs text-charcoal/60 max-w-sm mx-auto mb-20">
            Create tagged QR codes (such as &ldquo;Expo 2026 standee&rdquo; or &ldquo;Desk Counter&rdquo;) to track where your visits and leads come from.
          </p>
          <ActionButton variant="primary" onClick={() => setIsCreateOpen(true)} className="min-h-[44px]">
            Create first QR tag
          </ActionButton>
        </div>
      )}

      {/* Populated List */}
      {!isLoading && items.length > 0 && (
        <div className="space-y-12">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-sand-border rounded-16 p-20 flex flex-col md:flex-row md:items-center justify-between gap-16 shadow-sm hover:border-sand-border-focus transition-all"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-8">
                  <span className="font-bold text-sm text-charcoal">
                    {item.label || item.source}
                  </span>
                  {item.source === 'default' && (
                    <span className="text-[10px] font-bold px-8 py-2 rounded-8 bg-bridge-orange/20 text-deep-orange">
                      Default
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-bold px-8 py-2 rounded-8 ${
                      item.status === 'active'
                        ? 'bg-success/15 text-success'
                        : 'bg-charcoal/10 text-charcoal/60'
                    }`}
                  >
                    {item.status.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center gap-8 text-xs text-charcoal/70">
                  <span className="font-mono bg-sand/60 px-6 py-2 rounded-4 text-charcoal">
                    {item.shortUrl}
                  </span>
                  <span className="text-charcoal/40">&rarr;</span>
                  <span className="truncate max-w-xs text-charcoal/60" title={item.destinationUrl}>
                    {item.destinationUrl}
                  </span>
                </div>
              </div>

              {/* Action buttons with minimum 44px touch targets */}
              <div className="flex items-center gap-8 self-end md:self-auto">
                <button
                  type="button"
                  onClick={() => handleCopy(item.code, item.shortUrl)}
                  className="min-h-[44px] min-w-[44px] px-12 py-8 rounded-10 text-xs font-bold border border-sand-border text-charcoal hover:bg-sand/60 transition-colors"
                  aria-label="Copy short link URL"
                >
                  {copiedCode === item.code ? 'Copied!' : 'Copy link'}
                </button>

                <ActionButton
                  variant="secondary"
                  onClick={() => setSelectedDownloadItem(item)}
                  className="min-h-[44px] text-xs"
                >
                  Download QR
                </ActionButton>

                {onUpdateTag && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateTag(item.id, {
                        status: item.status === 'active' ? 'disabled' : 'active',
                      })
                    }
                    className="min-h-[44px] px-12 py-8 rounded-10 text-xs font-bold border border-sand-border text-charcoal/70 hover:bg-sand/40 transition-colors"
                  >
                    {item.status === 'active' ? 'Disable' : 'Enable'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Source Tag Modal */}
      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 backdrop-blur-sm p-16 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-tag-title"
        >
          <div className="bg-white rounded-arch p-24 sm:p-32 max-w-md w-full shadow-xl border border-sand-border">
            <h3 id="create-tag-title" className="text-lg font-bold text-charcoal mb-4">
              Add new source-tagged QR
            </h3>
            <p className="text-xs text-charcoal/60 mb-20">
              Each tag creates an immutable short link code with dedicated attribution analytics.
            </p>

            {createError && (
              <div className="bg-error/10 text-error p-12 rounded-8 text-xs font-bold mb-16" role="alert">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-16">
              <div>
                <label className="block text-xs font-bold text-charcoal mb-4">
                  Source tag <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={sourceInput}
                  onChange={(e) => setSourceInput(e.target.value)}
                  placeholder='e.g. Expo 2026 standee, Brochure, Counter'
                  className="w-full min-h-[44px] px-12 rounded-10 border border-sand-border text-sm text-charcoal focus:border-bridge-orange focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-charcoal mb-4">
                  Display label (optional)
                </label>
                <input
                  type="text"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  placeholder="e.g. Exhibition Hall B"
                  className="w-full min-h-[44px] px-12 rounded-10 border border-sand-border text-sm text-charcoal focus:border-bridge-orange focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-charcoal mb-4">
                  Destination URL (optional)
                </label>
                <input
                  type="text"
                  value={destInput}
                  onChange={(e) => setDestInput(e.target.value)}
                  placeholder="Leave blank for card default"
                  className="w-full min-h-[44px] px-12 rounded-10 border border-sand-border text-sm text-charcoal focus:border-bridge-orange focus:outline-none"
                />
                {!isAdmin && (
                  <p className="text-[11px] text-charcoal/50 mt-4">
                    External destination URLs require Company Admin approval.
                  </p>
                )}
              </div>

              <div className="flex gap-12 justify-end pt-16 border-t border-sand-border">
                <ActionButton
                  type="button"
                  variant="secondary"
                  onClick={() => setIsCreateOpen(false)}
                  className="min-h-[44px]"
                >
                  Cancel
                </ActionButton>
                <ActionButton
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting}
                  className="min-h-[44px]"
                >
                  {isSubmitting ? 'Creating...' : 'Create QR tag'}
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Download Modal */}
      {selectedDownloadItem && (
        <QrDownloadModal
          isOpen={true}
          onClose={() => setSelectedDownloadItem(null)}
          qrId={selectedDownloadItem.id}
          sourceLabel={selectedDownloadItem.label || selectedDownloadItem.source}
          shortUrl={selectedDownloadItem.shortUrl}
          onDownload={({ format, size, template }) => {
            onDownloadAsset(selectedDownloadItem.id, format, size, template);
            setSelectedDownloadItem(null);
          }}
        />
      )}
    </div>
  );
};
