"use client";

const statusConfig: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  fresh: {
    bg: "bg-emerald-500/10 border-emerald-500/30",
    text: "text-emerald-400",
    label: "Fresh",
    icon: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  expiring_soon: {
    bg: "bg-amber-500/10 border-amber-500/30",
    text: "text-amber-400",
    label: "Expiring Soon",
    icon: "M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z",
  },
  expired: {
    bg: "bg-red-500/10 border-red-500/30",
    text: "text-red-400",
    label: "Expired",
    icon: "M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  unknown: {
    bg: "bg-slate-700/30 border-slate-600/40",
    text: "text-slate-400",
    label: "Unknown",
    icon: "M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z",
  },
};

interface ExpiryStatusBadgeProps {
  status: string;
  daysUntilExpiry?: number | null;
  size?: "sm" | "md" | "lg";
}

export default function ExpiryStatusBadge({ status, daysUntilExpiry, size = "md" }: ExpiryStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.unknown;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-3 py-1 text-sm gap-1.5",
    lg: "px-4 py-2 text-base gap-2",
  };

  const iconSize = { sm: "w-3 h-3", md: "w-4 h-4", lg: "w-5 h-5" };

  let label = config.label;
  if (daysUntilExpiry !== null && daysUntilExpiry !== undefined) {
    if (status === "expired") {
      label += ` (${Math.abs(daysUntilExpiry)}d ago)`;
    } else if (status === "expiring_soon") {
      label += ` (${daysUntilExpiry}d left)`;
    }
  }

  return (
    <span className={`inline-flex items-center border rounded-full font-medium ${config.bg} ${config.text} ${sizeClasses[size]}`}>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconSize[size]}>
        <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
      </svg>
      {label}
    </span>
  );
}
