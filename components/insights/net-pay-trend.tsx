import type { PayMonth } from "@/lib/domain/insights";
import { formatIls, shortMonthLabel } from "@/lib/format";

export function NetPayTrend({ months }: { months: PayMonth[] }) {
  if (months.length < 2) return null;

  const peak = Math.max(...months.map((row) => Math.max(row.netPay, row.grossPay)), 1);
  const width = 640;
  const height = 180;
  const padX = 28;
  const padTop = 16;
  const padBottom = 28;
  const chartHeight = height - padTop - padBottom;
  const slot = (width - padX * 2) / months.length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-slate-900">Net pay trend</h2>
        <p className="text-xs text-slate-500">
          Last {months.length} months · lighter bars are gross
        </p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Net and gross pay over recent months"
        className="h-44 w-full"
      >
        {months.map((row, index) => {
          const x = padX + slot * index;
          const barWidth = Math.max(6, slot * 0.36);
          const gap = 2;
          const grossH = (row.grossPay / peak) * chartHeight;
          const netH = (row.netPay / peak) * chartHeight;
          const center = x + slot / 2;
          return (
            <g key={`${row.year}-${row.month}`}>
              <rect
                x={center - barWidth - gap / 2}
                y={padTop + chartHeight - grossH}
                width={barWidth}
                height={grossH}
                rx={2}
                className="fill-slate-200"
                fill="#e2e8f0"
              />
              <rect
                x={center + gap / 2}
                y={padTop + chartHeight - netH}
                width={barWidth}
                height={netH}
                rx={2}
                fill="#0f172a"
              >
                <title>
                  {shortMonthLabel(row.year, row.month)} {row.year}: net{" "}
                  {formatIls(row.netPay)}
                  {row.grossPay > 0 ? `, gross ${formatIls(row.grossPay)}` : ""}
                </title>
              </rect>
              <text
                x={center}
                y={height - 8}
                textAnchor="middle"
                fill="#64748b"
                fontSize="10"
              >
                {shortMonthLabel(row.year, row.month)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
