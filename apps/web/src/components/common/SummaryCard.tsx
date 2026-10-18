"use client";

type SummaryCardProps = {
  label: string;
  value: number;
};

export function SummaryCard({
  label,
  value,
}: SummaryCardProps) {
  return (
    <div className="app-summary-card rounded-2xl border p-5 shadow-sm">
      <p className="app-summary-card-label text-sm font-medium">
        {label}
      </p>

      <p className="app-summary-card-value mt-2 text-3xl font-bold tracking-tight">
        {value}
      </p>
    </div>
  );
}
