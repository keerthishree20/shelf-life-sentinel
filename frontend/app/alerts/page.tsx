"use client";

import { useEffect, useState } from "react";
import { getAlerts, markAlertRead } from "@/lib/api";
import type { Alert } from "@/lib/types";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showDismissed, setShowDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getAlerts(showDismissed);
        setAlerts(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [showDismissed]);

  const handleDismiss = async (id: number) => {
    try {
      await markAlertRead(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDismissAll = async () => {
    try {
      await Promise.all(alerts.filter((a) => !a.is_read).map((a) => markAlertRead(a.id)));
      setAlerts([]);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Alerts</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDismissed(!showDismissed)}
            className="px-3 py-1.5 bg-slate-800/50 border border-slate-700 text-slate-400 text-sm rounded-lg hover:border-slate-600 transition-colors"
          >
            {showDismissed ? "Hide Dismissed" : "Show Dismissed"}
          </button>
          {alerts.some((a) => !a.is_read) && (
            <button
              onClick={handleDismissAll}
              className="px-3 py-1.5 bg-slate-800/50 border border-slate-700 text-slate-400 text-sm rounded-lg hover:border-slate-600 transition-colors"
            >
              Dismiss All
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : alerts.length > 0 ? (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const isExpired = alert.alert_type === "expired";
            return (
              <div
                key={alert.id}
                className={`border rounded-xl p-4 flex items-start justify-between gap-4 ${
                  isExpired
                    ? "bg-red-500/5 border-red-500/20"
                    : "bg-amber-500/5 border-amber-500/20"
                } ${alert.is_read ? "opacity-50" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isExpired ? "bg-red-500/20" : "bg-amber-500/20"
                  }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 ${isExpired ? "text-red-400" : "text-amber-400"}`}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </div>
                  <div>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-1 ${
                      isExpired ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"
                    }`}>
                      {isExpired ? "EXPIRED" : "EXPIRING SOON"}
                    </span>
                    <p className="text-slate-300 text-sm">{alert.message}</p>
                    <p className="text-slate-600 text-xs mt-1">
                      {alert.created_at ? new Date(alert.created_at).toLocaleString() : ""}
                    </p>
                  </div>
                </div>
                {!alert.is_read && (
                  <button
                    onClick={() => handleDismiss(alert.id)}
                    className="text-slate-500 hover:text-slate-300 flex-shrink-0"
                    title="Dismiss"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-slate-700 mx-auto mb-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-slate-500">No active alerts</p>
          <p className="text-slate-600 text-sm mt-1">All products are within safe dates</p>
        </div>
      )}
    </div>
  );
}
