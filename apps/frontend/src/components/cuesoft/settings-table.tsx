import { FC, ReactNode } from 'react';
import clsx from 'clsx';

/**
 * SettingsTable — the settings-page grid list (survey family B), duplicated
 * across webhooks.tsx, autopost.tsx, sets.tsx and signatures.component.tsx:
 * a bare `grid w-full gap-y-[10px]` whose header divs are styled identically
 * to the body cells (no size/weight/uppercase treatment — that flatness is
 * the family's look, keep it).
 *
 * BUILD ONLY (plan row 15): all four candidate sites are pristine upstream
 * files — adopt opportunistically, only when a fork change already touches
 * one. When adopting, headers default to left-aligned (matching 3 of the 4
 * sites; signatures' centered headers are accidental — `center` exists for
 * an exact-parity migration if wanted).
 *
 * Scope: the grid only. The surrounding settings card
 * (`bg-sixth border-fifth border rounded-[4px] p-[24px]`), the
 * hide-when-empty behaviour and the trailing "Add a ..." Button stay at the
 * call site. Rows pass through as children — keep the existing
 * Fragment-of-cells pattern, exactly `columns.length` cells per row.
 *
 * The track list is emitted as an inline style; upstream's
 * `grid-cols-[1fr,1fr,1fr,1fr]` compiles to the same space-separated value
 * (Tailwind converts the commas), and this family has no responsive override
 * that an inline style could shadow.
 */

export interface SettingsTableColumn {
  /** Header cell content, e.g. t('name', 'Name'). */
  label: ReactNode;
  /** CSS grid track, default '1fr' (sets.tsx widens its Name column to '2fr'). */
  width?: string;
  /** Center this header (signatures parity only); default left-aligned. */
  center?: boolean;
}

export const SettingsTable: FC<{
  columns: SettingsTableColumn[];
  /** Fragment-of-cells rows: columns.length cells per row, in column order. */
  children: ReactNode;
  className?: string;
}> = ({ columns, children, className }) => (
  <div
    className={clsx('grid w-full gap-y-[10px]', className)}
    style={{
      gridTemplateColumns: columns
        .map((column) => column.width ?? '1fr')
        .join(' '),
    }}
  >
    {columns.map((column, index) => (
      <div key={index} className={clsx(column.center && 'text-center')}>
        {column.label}
      </div>
    ))}
    {children}
  </div>
);
