import React, { useState } from 'react';
import { ActionButton } from './ActionButton';

export interface QrDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrId: string;
  sourceLabel: string;
  shortUrl: string;
  onDownload: (options: { format: 'png' | 'svg' | 'pdf'; size: number; template?: 'a4' | 'a5' }) => void;
}

export const QrDownloadModal: React.FC<QrDownloadModalProps> = ({
  isOpen,
  onClose,
  qrId: _qrId,
  sourceLabel,
  shortUrl,
  onDownload,
}) => {
  const [format, setFormat] = useState<'png' | 'svg' | 'pdf'>('png');
  const [resolution, setResolution] = useState<number>(1000);
  const [standeeTemplate, setStandeeTemplate] = useState<'a4' | 'a5'>('a4');
  const [isStandee, setIsStandee] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleDownload = () => {
    onDownload({
      format,
      size: resolution,
      template: isStandee ? standeeTemplate : undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 backdrop-blur-sm p-16 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-download-title"
    >
      <div className="bg-white rounded-arch p-24 sm:p-32 max-w-lg w-full shadow-xl border border-sand-border">
        <div className="flex items-center justify-between pb-16 border-b border-sand-border mb-20">
          <div>
            <h2 id="qr-download-title" className="text-lg font-bold text-charcoal">
              Download branded QR code
            </h2>
            <p className="text-xs text-charcoal/60 mt-2">
              {sourceLabel} &bull; <span className="font-mono text-charcoal/80">{shortUrl}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-44 h-44 rounded-full flex items-center justify-center text-charcoal/60 hover:text-charcoal hover:bg-sand transition-colors"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {/* Mode Selector */}
        <div className="flex gap-8 mb-20">
          <button
            type="button"
            onClick={() => setIsStandee(false)}
            className={`min-h-[44px] flex-1 px-16 py-8 rounded-12 text-sm font-bold border transition-colors ${
              !isStandee
                ? 'bg-charcoal text-white border-charcoal'
                : 'bg-warm-paper text-charcoal/80 border-sand-border hover:bg-sand'
            }`}
          >
            QR code only
          </button>
          <button
            type="button"
            onClick={() => setIsStandee(true)}
            className={`min-h-[44px] flex-1 px-16 py-8 rounded-12 text-sm font-bold border transition-colors ${
              isStandee
                ? 'bg-charcoal text-white border-charcoal'
                : 'bg-warm-paper text-charcoal/80 border-sand-border hover:bg-sand'
            }`}
          >
            Counter standee template
          </button>
        </div>

        {!isStandee ? (
          <>
            {/* Format Selection */}
            <div className="mb-20">
              <label className="block text-xs font-bold text-charcoal/80 mb-8 uppercase tracking-wider">
                File format
              </label>
              <div className="grid grid-cols-3 gap-8">
                {(['png', 'svg', 'pdf'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setFormat(fmt)}
                    className={`min-h-[44px] p-12 rounded-12 text-center font-bold text-sm border uppercase transition-colors ${
                      format === fmt
                        ? 'border-bridge-orange bg-sand/60 text-charcoal'
                        : 'border-sand-border bg-white text-charcoal/70 hover:bg-sand/30'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            {/* Resolution selection for PNG */}
            {format === 'png' && (
              <div className="mb-24">
                <label className="block text-xs font-bold text-charcoal/80 mb-8 uppercase tracking-wider">
                  Resolution
                </label>
                <div className="grid grid-cols-2 gap-8">
                  <button
                    type="button"
                    onClick={() => setResolution(600)}
                    className={`min-h-[44px] p-12 rounded-12 text-left border transition-colors ${
                      resolution === 600
                        ? 'border-bridge-orange bg-sand/60 text-charcoal'
                        : 'border-sand-border bg-white text-charcoal/70 hover:bg-sand/30'
                    }`}
                  >
                    <div className="text-xs font-bold">Digital / Web</div>
                    <div className="text-[10px] text-charcoal/60">600 x 600 px</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolution(1200)}
                    className={`min-h-[44px] p-12 rounded-12 text-left border transition-colors ${
                      resolution === 1200
                        ? 'border-bridge-orange bg-sand/60 text-charcoal'
                        : 'border-sand-border bg-white text-charcoal/70 hover:bg-sand/30'
                    }`}
                  >
                    <div className="text-xs font-bold">Print (300 DPI)</div>
                    <div className="text-[10px] text-charcoal/60">1200 x 1200 px &bull; 2 cm scannable</div>
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="mb-24">
            <label className="block text-xs font-bold text-charcoal/80 mb-8 uppercase tracking-wider">
              Standee size
            </label>
            <div className="grid grid-cols-2 gap-8 mb-16">
              <button
                type="button"
                onClick={() => setStandeeTemplate('a4')}
                className={`min-h-[44px] p-12 rounded-12 text-left border transition-colors ${
                  standeeTemplate === 'a4'
                    ? 'border-bridge-orange bg-sand/60 text-charcoal'
                    : 'border-sand-border bg-white text-charcoal/70 hover:bg-sand/30'
                }`}
              >
                <div className="text-xs font-bold">A4 Standee</div>
                <div className="text-[10px] text-charcoal/60">210 x 297 mm &bull; Full page</div>
              </button>
              <button
                type="button"
                onClick={() => setStandeeTemplate('a5')}
                className={`min-h-[44px] p-12 rounded-12 text-left border transition-colors ${
                  standeeTemplate === 'a5'
                    ? 'border-bridge-orange bg-sand/60 text-charcoal'
                    : 'border-sand-border bg-white text-charcoal/70 hover:bg-sand/30'
                }`}
              >
                <div className="text-xs font-bold">A5 Counter Standee</div>
                <div className="text-[10px] text-charcoal/60">148 x 210 mm &bull; Compact desk</div>
              </button>
            </div>
            <p className="text-xs text-charcoal/60 leading-normal">
              Includes 3 mm print bleed margin, crop marks, company logo, and scannable QR code.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-12 justify-end pt-16 border-t border-sand-border">
          <ActionButton variant="secondary" onClick={onClose} className="min-h-[44px]">
            Cancel
          </ActionButton>
          <ActionButton variant="primary" onClick={handleDownload} className="min-h-[44px]">
            Download file
          </ActionButton>
        </div>
      </div>
    </div>
  );
};
