import React from 'react';
import { cn } from './ActionButton';

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children: React.ReactNode;
}

export const Table: React.FC<TableProps> = ({ className, children, ...props }) => {
  return (
    <div className="w-full overflow-x-auto border border-sand-border dark:border-sand-border/30 rounded-panel bg-warm-paper dark:bg-charcoal">
      <table className={cn('w-full border-collapse text-left font-body text-sm', className)} {...props}>
        {children}
      </table>
    </div>
  );
};

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <thead className={cn('sticky top-0 bg-sand/40 dark:bg-charcoal-deep border-b border-sand-border dark:border-sand-border/30 z-10', className)} {...props}>
      {children}
    </thead>
  );
};

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  className,
  children,
  ...props
}) => {
  return <tbody className={cn('divide-y divide-sand-border dark:divide-sand-border/30', className)} {...props}>{children}</tbody>;
};

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <tr
      className={cn(
        'transition-colors duration-150 hover:bg-sand/20 dark:hover:bg-charcoal-deep/50',
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
};

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <th
      scope="col"
      className={cn(
        'px-4 py-3 text-xs font-bold uppercase tracking-wider text-charcoal/70 dark:text-warm-paper/70 select-none',
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
};

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <td
      className={cn('px-4 py-3.5 text-charcoal dark:text-warm-paper align-middle', className)}
      {...props}
    >
      {children}
    </td>
  );
};
