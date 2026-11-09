import type { ReactNode } from "react";

/**
 * Text alternative for a chart: the same numbers as a real table, collapsed by default so it does
 * not compete with the chart visually but stays reachable by keyboard and screen readers.
 */
export function ChartDataTable({
  caption,
  headers,
  children,
}: {
  caption: string;
  headers: string[];
  children: ReactNode;
}) {
  return (
    <details className="mt-3 text-sm">
      <summary className="w-fit cursor-pointer rounded text-muted-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        Ver datos como tabla
      </summary>
      <div className="mt-2 max-h-64 overflow-auto rounded-md border">
        <table aria-label={caption} className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-muted text-muted-foreground">
            <tr>
              {headers.map((header, index) => (
                <th key={header} scope="col" className={`px-3 py-1.5 font-medium ${index > 0 ? "text-right" : ""}`}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_td]:px-3 [&_td]:py-1.5 [&_td:not(:first-child)]:text-right [&_td:not(:first-child)]:tabular-nums [&_tr]:border-t">
            {children}
          </tbody>
        </table>
      </div>
    </details>
  );
}
