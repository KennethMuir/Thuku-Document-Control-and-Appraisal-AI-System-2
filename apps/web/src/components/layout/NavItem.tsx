"use client";

export function NavItem({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={
        active
          ? "page"
          : undefined
      }
      className={`app-sidebar-nav-item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 ${
        active
          ? "app-sidebar-nav-item-active"
          : "app-sidebar-nav-item-inactive"
      }`}
    >
      <span
        aria-hidden="true"
        className="w-5 text-center"
      >
        {icon}
      </span>

      {label}
    </button>
  );
}

