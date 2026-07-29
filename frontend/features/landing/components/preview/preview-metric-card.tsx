import { cn } from "@/lib/utils";

const TONE_STYLES = {
  sky: "from-sky-500/10 to-transparent border-sky-200/60",
  teal: "from-teal-500/10 to-transparent border-teal-200/60",
  amber: "from-amber-500/10 to-transparent border-amber-200/60",
  emerald: "from-emerald-500/10 to-transparent border-emerald-200/60",
} as const;

type PreviewMetricCardProps = {
  label: string;
  value: string;
  delta: string;
  tone: keyof typeof TONE_STYLES;
};

export function PreviewMetricCard({ label, value, delta, tone }: PreviewMetricCardProps) {
  return (
    <article
      className={cn(
        "rounded-xl border bg-gradient-to-br p-3 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md sm:p-3.5",
        TONE_STYLES[tone],
        "border-slate-200 bg-white",
      )}
    >
      <p className="truncate text-[11px] font-medium text-slate-500 sm:text-xs">{label}</p>
      <p className="mt-1.5 font-display text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] text-slate-500">{delta}</p>
    </article>
  );
}
