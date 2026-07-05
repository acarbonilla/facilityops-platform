import type { ReactNode } from "react";

export interface DataTableColumn<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  caption?: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
}

export function DataTable<T>({
  caption,
  columns,
  getRowKey,
  rows,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th
                className={[
                  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500",
                  column.className ?? "",
                ].join(" ")}
                key={column.header}
                scope="col"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row) => (
            <tr className="align-top" key={getRowKey(row)}>
              {columns.map((column) => (
                <td
                  className={[
                    "whitespace-nowrap px-4 py-3 text-sm text-slate-700",
                    column.className ?? "",
                  ].join(" ")}
                  key={column.header}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
