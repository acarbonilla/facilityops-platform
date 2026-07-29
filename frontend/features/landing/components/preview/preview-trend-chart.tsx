type PreviewTrendChartProps = {
  title: string;
  summary: string;
  points: readonly number[];
  labels: readonly string[];
};

export function PreviewTrendChart({
  title,
  summary,
  points,
  labels,
}: PreviewTrendChartProps) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = Math.max(max - min, 1);
  const width = 280;
  const height = 88;
  const padX = 8;
  const padY = 10;

  const coords = points.map((value, index) => {
    const x =
      padX + (index / Math.max(points.length - 1, 1)) * (width - padX * 2);
    const y =
      height - padY - ((value - min) / range) * (height - padY * 2);
    return { x, y, value, label: labels[index] ?? `Day ${index + 1}` };
  });

  const linePath = coords
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${height - padY} L ${coords[0].x} ${height - padY} Z`;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-sm font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{summary}</p>
        </div>
        <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
          Upward trend
        </span>
      </div>
      <div className="mt-3" aria-hidden="true">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-24 w-full"
          role="img"
        >
          <defs>
            <linearGradient id="preview-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(14 165 233)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="rgb(14 165 233)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#preview-trend-fill)" />
          <path
            d={linePath}
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {coords.map((point) => (
            <circle
              key={point.label}
              cx={point.x}
              cy={point.y}
              r="3"
              fill="white"
              stroke="rgb(14 165 233)"
              strokeWidth="2"
            />
          ))}
        </svg>
        <div className="mt-1 flex justify-between px-1 text-[10px] text-slate-400">
          {labels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>
      <p className="sr-only">{summary}</p>
    </article>
  );
}
