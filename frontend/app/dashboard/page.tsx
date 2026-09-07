"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import StatCard from "@/components/StatCard";
import AlertBanner from "@/components/AlertBanner";
import { getDashboardStats, getCategoryBreakdown, getHistory } from "@/lib/api";
import type { DashboardStats, CategoryBreakdown, ScanLog } from "@/lib/types";
import ExpiryStatusBadge from "@/components/ExpiryStatusBadge";

const PIE_COLORS = ["#10b981", "#f59e0b", "#ef4444"];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [categories, setCategories] = useState<CategoryBreakdown[]>([]);
  const [recentScans, setRecentScans] = useState<ScanLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, c, h] = await Promise.all([
          getDashboardStats(),
          getCategoryBreakdown(),
          getHistory(5, 0),
        ]);
        setStats(s);
        setCategories(c);
        setRecentScans(h);
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 h-24 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const pieData = [
    { name: "Fresh", value: stats.fresh_count },
    { name: "Expiring Soon", value: stats.expiring_soon_count },
    { name: "Expired", value: stats.expired_count },
  ].filter((d) => d.value > 0);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>

      <AlertBanner expiredCount={stats.expired_count} />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total Products" value={stats.total_products} color="text-white" />
        <StatCard label="Fresh" value={stats.fresh_count} color="text-emerald-400" />
        <StatCard label="Expiring Soon" value={stats.expiring_soon_count} color="text-amber-400" />
        <StatCard label="Expired" value={stats.expired_count} color="text-red-400" />
        <StatCard label="Scans Today" value={stats.scans_today} color="text-cyan-400" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Expiry Status Distribution</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#e2e8f0" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-slate-500">No products tracked yet</div>
          )}
        </div>

        {/* Bar Chart */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Category Breakdown</h2>
          {categories.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={categories}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="category" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#e2e8f0" }} />
                <Legend />
                <Bar dataKey="fresh" fill="#10b981" name="Fresh" stackId="stack" />
                <Bar dataKey="expiring_soon" fill="#f59e0b" name="Expiring" stackId="stack" />
                <Bar dataKey="expired" fill="#ef4444" name="Expired" stackId="stack" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-slate-500">No categories yet</div>
          )}
        </div>
      </div>

      {/* Recent Scans */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Recent Scans</h2>
          <a href="/history" className="text-cyan-400 text-sm hover:underline">View all</a>
        </div>
        {recentScans.length > 0 ? (
          <div className="space-y-2">
            {recentScans.map((scan) => (
              <div key={scan.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                <div>
                  <p className="text-white text-sm">{scan.product_name || "Unknown"}</p>
                  <p className="text-slate-500 text-xs">{scan.barcode} • {scan.scan_type}</p>
                </div>
                <div className="flex items-center gap-3">
                  <ExpiryStatusBadge status={scan.result_status} size="sm" />
                  <span className="text-slate-500 text-xs">
                    {scan.scanned_at ? new Date(scan.scanned_at).toLocaleTimeString() : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-sm text-center py-6">No scans yet. Start by scanning a product.</p>
        )}
      </div>
    </div>
  );
}
