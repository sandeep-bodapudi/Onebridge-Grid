import React, { useRef, useState, useEffect } from 'react';
import { cn } from './ActionButton';

export interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (otp: string) => void;
  onComplete?: (otp: string) => void;
  resendSeconds?: number;
  onResend?: () => void;
  onChangeNumber?: () => void;
  disabled?: boolean;
  hasError?: boolean;
  className?: string;
}

/**
 * OtpInput: 6-box OTP verification entry.
 * - Autofocuses first box
 * - Accepts full paste of 6-digit code
 * - Advances focus on entry, retreats on backspace
 * - Includes resend countdown timer and "Change number" callback
 */
export const OtpInput: React.FC<OtpInputProps> = ({
  length = 6,
  value,
  onChange,
  onComplete,
  resendSeconds = 30,
  onResend,
  onChangeNumber,
  disabled = false,
  hasError = false,
  className,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [timeLeft, setTimeLeft] = useState(resendSeconds);

  // Autofocus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Resend countdown
  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  // Cells live in a ref as well as state: fast typing moves focus before the
  // parent re-renders, so reading `value` would see a stale code and drop digits.
  const toCells = (v: string) => Array.from({ length }, (_, i) => v[i] ?? '');
  const cellsRef = useRef<string[]>(toCells(value));
  const [cells, setCells] = useState<string[]>(cellsRef.current);

  useEffect(() => {
    if (value !== cellsRef.current.join('')) {
      cellsRef.current = toCells(value);
      setCells(cellsRef.current);
    }
  }, [value]);

  const commit = (next: string[]) => {
    cellsRef.current = next;
    setCells(next);
    const code = next.join('');
    onChange(code);
    if (code.length === length && next.every(Boolean) && onComplete) onComplete(code);
  };

  const digits = cells;

  const handleInputChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const typed = e.target.value.replace(/\D/g, '');
    if (e.target.value && !typed) return;
    // SMS autofill and some keyboards deliver several digits in one event: spread them across the boxes.
    const incoming = typed.startsWith(cellsRef.current[index]) && typed.length > 1 ? typed.slice(cellsRef.current[index].length) : typed;
    if (incoming.length > 1) {
      const next = [...cellsRef.current];
      incoming
        .slice(0, length - index)
        .split('')
        .forEach((d, i) => {
          next[index + i] = d;
        });
      commit(next);
      inputRefs.current[Math.min(index + incoming.length, length - 1)]?.focus();
      return;
    }
    const char = incoming.slice(-1);
    const next = [...cellsRef.current];
    next[index] = char;
    commit(next);
    if (char && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !cellsRef.current[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < length - 1) inputRefs.current[index + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (pasted) {
      commit(toCells(pasted));
      inputRefs.current[Math.min(pasted.length, length - 1)]?.focus();
    }
  };

  const handleResendClick = () => {
    if (timeLeft <= 0 && onResend) {
      onResend();
      setTimeLeft(resendSeconds);
    }
  };

  return (
    <div className={cn('flex flex-col items-center gap-4 w-full', className)}>
      <div className="flex gap-2 justify-center w-full max-w-sm" role="group" aria-label="One-time verification code">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={length}
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            value={digit}
            disabled={disabled}
            aria-label={`Digit ${index + 1}`}
            onChange={(e) => handleInputChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            className={cn(
              'w-11 h-12 text-center text-lg font-mono font-bold rounded-control transition-all duration-150',
              'bg-warm-paper text-charcoal border border-sand-border',
              'dark:bg-charcoal dark:text-warm-paper dark:border-sand-border/30',
              'focus-visible:outline-none focus:border-bridge-orange focus:ring-2 focus:ring-bridge-orange',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              hasError ? 'border-error text-error focus:border-error focus:ring-error' : ''
            )}
          />
        ))}
      </div>

      <div className="flex items-center justify-between w-full max-w-sm text-sm text-charcoal/70 dark:text-warm-paper/70 px-1">
        <div>
          {timeLeft > 0 ? (
            <span>Resend code in {timeLeft}s</span>
          ) : (
            <button
              type="button"
              onClick={handleResendClick}
              className="min-h-[44px] font-semibold text-charcoal underline underline-offset-2 dark:text-warm-paper"
            >
              Resend code
            </button>
          )}
        </div>

        {onChangeNumber && (
          <button
            type="button"
            onClick={onChangeNumber}
            className="min-h-[44px] font-semibold text-charcoal underline underline-offset-2 dark:text-warm-paper"
          >
            Change number
          </button>
        )}
      </div>
    </div>
  );
};
