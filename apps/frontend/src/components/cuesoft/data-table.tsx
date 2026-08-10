import { CSSProperties, ReactNode } from 'react';
import clsx from 'clsx';

/**
 * DataTable — the "admin card table" recipe (survey family A), generalized.
 *
 * This is the exact class recipe duplicated verbatim between
 * admin-errors.component.tsx (errors list, incl. the only phone: collapse in
 * the family) and admin-stats.component.tsx (PerSocialTable ×3):
 *
 *   card:   border border-newTableBorder rounded-[8px] overflow-hidden
 *   header: grid gap-[12px] px-[12px] py-[10px] bg-newBgColorInner
 *           text-[13px] text-newTextColor/60 border-b border-newTableBorder
 *           (sentence-case muted sub-label — the type scale bans
 *           tracked-uppercase eyebrows)
 *   row:    grid gap-[12px] px-[12px] py-[10px] text-[13px]
 *           border-b border-newTableBorder last:border-b-0 items-start
 *   phone:  header hidden, rows collapse to a single column with gap-[6px]
 *
 * The column template is a plain CSS track list built from `columns[].width`
 * (default '1fr'). It is delivered through a CSS variable + the static
 * `grid-cols-[var(--cs-table-cols)]` class rather than an inline
 * `style={{gridTemplateColumns}}` on the grids — an inline style would
 * outrank `phone:grid-cols-1` and break the phone collapse, and a dynamic
 * class string would be invisible to the Tailwind JIT.
 *
 * Size-ladder note (global.scss): the recipe's text-[12px]/text-[13px] and
 * px/py values are below every ladder threshold, so this component renders
 * byte-identically to the hand-rolled originals — no data-cs needed.
 */

export interface DataTableColumn<T> {
  /** Stable identity for the column (used as the React key of its cells). */
  key: string;
  /** Header cell content, rendered sentence-case (no CSS uppercase). */
  header: ReactNode;
  /** CSS grid track for this column, e.g. '170px', '220px', '1fr'. Default '1fr'. */
  width?: string;
  /**
   * 'right' adds text-right to the header + body cells (and phone:text-left
   * under phoneStack, mirroring admin-errors' phone:justify-start intent).
   * Cells whose render output is a flex container should justify themselves —
   * pass the flex classes via cellClassName instead.
   */
  align?: 'left' | 'right';
  /** Extra classes for the body cell wrapper (e.g. 'break-all', 'opacity-90'). */
  cellClassName?: string;
  /** Body cell content for a row. */
  render: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  /**
   * Phone behaviour from admin-errors (the canonical site): the header row
   * hides and each data row stacks its cells in a single column. Default on;
   * turn off to match admin-stats' current no-collapse rendering exactly.
   */
  phoneStack?: boolean;
  /**
   * Rendered inside the card, under the header, when `rows` is empty — the
   * admin-stats placement ('No data for this timeframe.'). Omit it to render
   * an empty card body (admin-errors keeps its empty state outside the card).
   */
  empty?: ReactNode;
  /** Extra classes for the card wrapper. */
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  phoneStack = true,
  empty,
  className,
}: DataTableProps<T>) {
  const tracks = columns.map((column) => column.width ?? '1fr').join(' ');

  return (
    <div
      className={clsx(
        'border border-newTableBorder rounded-[8px] overflow-hidden',
        className
      )}
      style={{ '--cs-table-cols': tracks } as CSSProperties}
    >
      <div
        className={clsx(
          'grid grid-cols-[var(--cs-table-cols)] gap-[12px] px-[12px] py-[10px] bg-newBgColorInner text-[13px] text-newTextColor/60 border-b border-newTableBorder',
          phoneStack && 'phone:hidden'
        )}
      >
        {columns.map((column) => (
          <div
            key={column.key}
            className={clsx(column.align === 'right' && 'text-right')}
          >
            {column.header}
          </div>
        ))}
      </div>
      {rows.length === 0 && typeof empty !== 'undefined' ? (
        <div className="px-[12px] py-[10px] text-[13px] text-newTextColor/60">
          {empty}
        </div>
      ) : (
        rows.map((row) => (
          <div
            key={rowKey(row)}
            className={clsx(
              'grid grid-cols-[var(--cs-table-cols)] gap-[12px] px-[12px] py-[10px] text-[13px] border-b border-newTableBorder last:border-b-0 items-start',
              phoneStack && 'phone:grid-cols-1 phone:gap-[6px]'
            )}
          >
            {columns.map((column) => (
              <div
                key={column.key}
                className={clsx(
                  column.cellClassName,
                  column.align === 'right' && 'text-right',
                  column.align === 'right' && phoneStack && 'phone:text-left'
                )}
              >
                {column.render(row)}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
