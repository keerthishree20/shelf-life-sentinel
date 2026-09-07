"use client";

import { useEffect, useState } from "react";
import { getProducts } from "@/lib/api";
import type { Product } from "@/lib/types";
import ExpiryStatusBadge from "@/components/ExpiryStatusBadge";

const FILTERS = [
  { label: "All", value: "all" },
  { label: "Fresh", value: "fresh" },
  { label: "Expiring Soon", value: "expiring_soon" },
  { label: "Expired", value: "expired" },
];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getProducts(filter, undefined, search || undefined);
        setProducts(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [filter, search]);

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Products</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f.value
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                  : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-600"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500/50"
        />
      </div>

      {/* Product List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="space-y-3">
          {products.map((product) => (
            <div key={product.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
              {product.image_url ? (
                <img src={product.image_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-slate-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{product.name}</p>
                <p className="text-slate-500 text-xs">
                  {product.brand && `${product.brand} • `}{product.barcode}
                </p>
                {product.expiry_date && (
                  <p className="text-slate-500 text-xs mt-0.5">
                    Expires: {new Date(product.expiry_date).toLocaleDateString("en-IN")}
                  </p>
                )}
              </div>
              <ExpiryStatusBadge status={product.status} daysUntilExpiry={product.days_until_expiry} size="sm" />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-slate-700 mx-auto mb-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
          <p className="text-slate-500">No products found</p>
          <p className="text-slate-600 text-sm mt-1">Start by scanning a product</p>
        </div>
      )}
    </div>
  );
}
