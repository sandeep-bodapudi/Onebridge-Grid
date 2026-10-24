import React from 'react';
import { cn } from './ActionButton';

export interface TabItem {
  id: string;
  label: string;
  badge?: number | string;
  ariaControls?: string;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  ariaControlsPrefix?: string;
  className?: string;
}

/**
 * Tabs: Accessible tab list with straight Span line active deck.
 */
export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  ariaControlsPrefix,
  className,
}) => {
  return (
    <div
      role="tablist"
      className={cn('flex items-center gap-6 border-b border-sand-border dark:border-sand-border/30', className)}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const ariaControls = tab.ariaControls || (ariaControlsPrefix ? `${ariaControlsPrefix}-${tab.id}` : undefined);
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={ariaControls}
            id={`tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative pb-3 pt-2 font-body text-sm font-bold transition-colors duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal dark:focus-visible:outline-bridge-orange',
              isActive
                ? 'text-charcoal dark:text-warm-paper'
                : 'text-charcoal/60 hover:text-charcoal dark:text-warm-paper/60 dark:hover:text-warm-paper'
            )}
          >
            <span className="flex items-center gap-2">
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="px-1.5 py-0.5 text-xs rounded-control bg-sand dark:bg-charcoal text-charcoal dark:text-warm-paper">
                  {tab.badge}
                </span>
              )}
            </span>

            {/* Straight Span Line Indicator */}
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 flex items-center">
                <div className="w-[3px] h-[3px] bg-bridge-orange" />
                <div className="flex-1 h-[2px] bg-bridge-orange" />
                <div className="w-[3px] h-[3px] bg-bridge-orange" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};
