"use client";

import Link from "next/link";

interface AlertBannerProps {
  expiredCount: number;
}

export default function AlertBanner({ expiredCount }: AlertBannerProps) {
  if (expiredCount === 0) return null;

  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-red-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div>
          <p className="text-red-400 font-medium text-sm">
            {expiredCount} product{expiredCount !== 1 ? "s" : ""} EXPIRED
          </p>
          <p className="text-slate-500 text-xs">Remove from shelf immediately</p>
        </div>
      </div>
      <Link
        href="/alerts"
        className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm rounded-lg transition-colors"
      >
        View Alerts
      </Link>
    </div>
  );
}
