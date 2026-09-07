"use client";

import { useEffect, useState } from "react";
import { getHistory } from "@/lib/api";
import type { ScanLog } from "@/lib/types";
import ExpiryStatusBadge from "@/components/ExpiryStatusBadge";

export default function HistoryPage() {
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getHistory(50, 0);
        setLogs(data);
        setHasMore(data.length === 50);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const loadMore = async () => {
    const newOffset = offset + 50;
    try {
      const data = await getHistory(50, newOffset);
      setLogs((prev) => [...prev, ...data]);
      setOffset(newOffset);
      setHasMore(data.length === 50);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Scan History</h1>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 h-16 animate-pulse" />
          ))}
        </div>
      ) : logs.length > 0 ? (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-slate-400 text-xs font-medium px-4 py-3">Time</th>
                  <th className="text-left text-slate-400 text-xs font-medium px-4 py-3">Product</th>
                  <th className="text-left text-slate-400 text-xs font-medium px-4 py-3">Barcode</th>
                  <th className="text-left text-slate-400 text-xs font-medium px-4 py-3">Type</th>
                  <th className="text-left text-slate-400 text-xs font-medium px-4 py-3">Status</th>
                  <th className="text-left text-slate-400 text-xs font-medium px-4 py-3">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-800/50 last:border-0">
                    <td className="px-4 py-3 text-slate-400 text-sm">
                      {log.scanned_at ? new Date(log.scanned_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-white text-sm">{log.product_name || "Unknown"}</td>
                    <td className="px-4 py-3 text-slate-400 text-sm font-mono">{log.barcode || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-slate-800 rounded text-slate-400 text-xs">{log.scan_type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <ExpiryStatusBadge status={log.result_status} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">
                      {log.confidence ? `${log.confidence}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white text-sm font-medium">{log.product_name || "Unknown"}</p>
                  <ExpiryStatusBadge status={log.result_status} size="sm" />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{log.barcode} • {log.scan_type}</span>
                  <span>{log.scanned_at ? new Date(log.scanned_at).toLocaleString() : ""}</span>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <button
              onClick={loadMore}
              className="w-full mt-4 py-2 bg-slate-800/50 border border-slate-700 text-slate-400 text-sm rounded-lg hover:border-slate-600 transition-colors"
            >
              Load More
            </button>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-slate-700 mx-auto mb-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-slate-500">No scan history yet</p>
          <p className="text-slate-600 text-sm mt-1">Scans will appear here after you scan products</p>
        </div>
      )}
    </div>
  );
}
