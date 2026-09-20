"use client";

type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({
  status,
}: StatusBadgeProps) {
  const normalized =
    status.toUpperCase();

  let classes =
    "bg-slate-100 text-slate-700";

  let label = status;

  if (
    normalized ===
    "AWAITING_DOCUMENT"
  ) {
    classes =
      "bg-amber-100 text-amber-800";

    label =
      "Awaiting Document";
  }

  if (
    normalized === "LINKED"
  ) {
    classes =
      "bg-emerald-100 text-emerald-800";

    label = "Linked";
  }

  if (
    normalized === "UNLINKED"
  ) {
    classes =
      "bg-slate-100 text-slate-700";

    label = "Unlinked";
  }

  if (
    normalized === "NEEDS_REVIEW" ||
    normalized === "REVIEW" ||
    normalized === "REVIEW_REQUIRED"
  ) {
    classes =
      "bg-orange-100 text-orange-800";

    label = "Needs Review";
  }

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {label}
    </span>
  );
}
