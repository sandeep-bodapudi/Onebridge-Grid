import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Button, type ButtonProps } from './Button';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ActionButtonProps = ButtonProps;

export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>((props, ref) => {
  return <Button ref={ref} {...props} />;
});

ActionButton.displayName = 'ActionButton';
