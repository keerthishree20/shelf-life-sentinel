"use client";

interface StatCardProps {
  label: string;
  value: number | string;
  color: string;
  icon?: React.ReactNode;
}

export default function StatCard({ label, value, color, icon }: StatCardProps) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400 text-sm">{label}</span>
        {icon && <span className={color}>{icon}</span>}
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
