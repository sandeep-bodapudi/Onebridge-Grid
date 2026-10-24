import React from 'react';
import { cn } from './ActionButton';

export interface PhoneFramePreviewProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  width?: number | string;
  height?: number | string;
  className?: string;
}

/**
 * PhoneFramePreview: Clean device mockup with straight 14px corners (no arches)
 * used for live card editing and preview.
 */
export const PhoneFramePreview: React.FC<PhoneFramePreviewProps> = ({
  children,
  width = 320,
  height = 640,
  className,
  ...props
}) => {
  return (
    <div
      role="region"
      aria-label="Live mobile card preview"
      className={cn(
        'relative bg-warm-paper rounded-sheet border-[6px] border-[#2A2627] shadow-overlay overflow-y-auto flex flex-col',
        className
      )}
      style={{
        width,
        height,
      }}
      {...props}
    >
      {/* Speaker bar */}
      <div className="w-16 h-1 bg-[#2A2627] rounded-full mx-auto my-2 shrink-0 opacity-80" />
      {/* Content */}
      <div className="flex-1 flex flex-col overflow-y-auto">{children}</div>
    </div>
  );
};
