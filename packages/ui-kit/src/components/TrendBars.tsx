import React from 'react';

export interface TrendPoint {
  /** ISO date (YYYY-MM-DD) */
  date: string;
  primary: number;
  secondary?: number;
}

export interface TrendBarsProps {
  points: TrendPoint[];
  primaryLabel: string;
  secondaryLabel?: string;
  /** Accessible summary, e.g. "Card views and saves per day, last 14 days". */
  title: string;
  className?: string;
}

/** A round axis maximum (5, 10, 15, 20, 30, 40, 50...) at or above the largest value. */
function niceMax(value: number): number {
  if (value <= 5) return 5;
  const steps = [10, 15, 20, 30, 40, 50, 60, 80, 100];
  for (const s of steps) if (value <= s) return s;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  return Math.ceil(value / magnitude) * magnitude;
}

/**
 * Daily paired bars (orange primary, sand secondary) on one scale with a faint grid.
 * Every axis label is a value the scale reaches; dates label every other day.
 */
export const TrendBars: React.FC<TrendBarsProps> = ({ points, primaryLabel, secondaryLabel, title, className }) => {
  const W = 560;
  const H = 156;
  const left = 28;
  const right = 556;
  const top = 14;
  const bottom = 130;
  const max = niceMax(Math.max(1, ...points.map((p) => Math.max(p.primary, p.secondary ?? 0))));
  const ticks = [max, Math.round((max * 2) / 3), Math.round(max / 3), 0];
  const y = (v: number) => bottom - (v / max) * (bottom - top);
  const slot = (right - left - 8) / Math.max(1, points.length);
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  };
  const totalPrimary = points.reduce((s, p) => s + p.primary, 0);
  const totalSecondary = points.reduce((s, p) => s + (p.secondary ?? 0), 0);

  return (
    <figure className={className} style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${totalPrimary} ${primaryLabel.toLowerCase()}${secondaryLabel ? `, ${totalSecondary} ${secondaryLabel.toLowerCase()}` : ''}`} className="block w-full h-auto">
        <g stroke="rgba(250,247,242,0.08)" strokeWidth="1">
          {ticks.map((t) => (
            <line key={t} x1={left} x2={right} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        <g fill="rgba(250,247,242,0.45)" fontSize="10" textAnchor="end">
          {ticks.map((t) => (
            <text key={t} x={left - 6} y={y(t) + 3}>
              {t}
            </text>
          ))}
        </g>
        {points.map((p, i) => {
          const x = left + 8 + i * slot;
          const w1 = slot * 0.42;
          const w2 = slot * 0.3;
          return (
            <g key={p.date}>
              <rect x={x} y={y(p.primary)} width={w1} height={Math.max(0, bottom - y(p.primary))} rx="2" fill="#F68713">
                <title>{`${fmt(p.date)}: ${p.primary} ${primaryLabel.toLowerCase()}`}</title>
              </rect>
              {p.secondary !== undefined ? (
                <rect x={x + slot * 0.46} y={y(p.secondary)} width={w2} height={Math.max(0, bottom - y(p.secondary))} rx="2" fill="#EFE8DC">
                  <title>{`${fmt(p.date)}: ${p.secondary} ${(secondaryLabel ?? '').toLowerCase()}`}</title>
                </rect>
              ) : null}
              {i % 2 === 0 ? (
                <text x={x + slot * 0.36} y={H - 6} fill="rgba(250,247,242,0.45)" fontSize="10" textAnchor="middle">
                  {fmt(p.date)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption className="flex gap-4 text-xs text-warm-paper/60 mt-2">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="w-2.5 h-2.5 rounded-sm bg-bridge-orange" />
          {primaryLabel}
        </span>
        {secondaryLabel ? (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="w-2.5 h-2.5 rounded-sm bg-sand" />
            {secondaryLabel}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
};
