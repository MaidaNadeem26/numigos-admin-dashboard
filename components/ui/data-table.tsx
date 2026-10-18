import type { ReactNode } from 'react';
import Link from 'next/link';

type Column<T> = {
  key: keyof T | string;
  header: string;
  render?: (row: T) => ReactNode;
};

type DataTableProps<T extends Record<string, unknown>> = {
  columns: Column<T>[];
  rows: T[];
  rowHref?: (row: T) => string;
  rowLabel?: (row: T) => string;
};

export function DataTable<T extends Record<string, unknown>>({ columns, rows, rowHref, rowLabel }: DataTableProps<T>) {
  return (
    <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_5px_20px_rgba(11,48,41,0.04)]">
      <div className="w-full overflow-x-auto overscroll-x-contain">
        <table className="min-w-full text-left text-sm text-ink whitespace-nowrap">
          <thead className="bg-field text-xs uppercase tracking-[0.08em] text-ink-muted">
            <tr>
              {columns.map((column) => (
                <th key={String(column.key)} className="px-4 py-3 font-medium">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-ink-muted">
                  No records available.
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex} className={`border-t border-line hover:bg-brand-mist/40 ${rowHref ? 'cursor-pointer' : ''}`}>
                  {columns.map((column) => (
                    <td key={`${rowIndex}-${String(column.key)}`} className={`px-4 py-3 align-middle ${rowHref ? 'relative' : ''}`}>
                      {rowHref ? <Link href={rowHref(row)} aria-label={rowLabel?.(row) ?? 'Open row'} className="absolute inset-0 z-10" /> : null}
                      <span className={rowHref ? 'relative z-0' : ''}>
                        {column.render ? column.render(row) : String(row[column.key as keyof T] ?? '—')}
                      </span>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
