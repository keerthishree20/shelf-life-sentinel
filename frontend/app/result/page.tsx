"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import Link from "next/link";
import ExpiryStatusBadge from "@/components/ExpiryStatusBadge";

function ResultContent() {
  const params = useSearchParams();
  const status = params.get("status") || "unknown";

  useEffect(() => {
    if (status === "expired") {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        gain.gain.value = 0.3;
        osc.start();
        setTimeout(() => { osc.frequency.value = 600; }, 150);
        setTimeout(() => { osc.frequency.value = 400; }, 300);
        setTimeout(() => { osc.stop(); ctx.close(); }, 500);
      } catch {}
    } else if (status === "expiring_soon") {
      if (navigator.vibrate) navigator.vibrate([150, 100, 150]);
    }
  }, [status]);
  const days = params.get("days") ? parseInt(params.get("days")!) : null;
  const name = params.get("name") || "Unknown Product";
  const barcode = params.get("barcode") || "";
  const brand = params.get("brand") || "";
  const category = params.get("category") || "";
  const mfg = params.get("mfg") || "";
  const expiry = params.get("expiry") || "";
  const image = params.get("image") || "";
  const confidence = params.get("confidence") ? parseInt(params.get("confidence")!) : null;

  const bannerConfig: Record<string, { gradient: string; title: string; subtitle: string }> = {
    fresh: {
      gradient: "from-emerald-500/20 via-emerald-500/5 to-transparent",
      title: "FRESH — Safe to Purchase",
      subtitle: days !== null ? `${days} days until expiry` : "Product is within shelf life",
    },
    expiring_soon: {
      gradient: "from-amber-500/20 via-amber-500/5 to-transparent",
      title: "EXPIRING SOON — Check Date",
      subtitle: days !== null ? `Only ${days} day(s) remaining` : "Product is near expiry",
    },
    expired: {
      gradient: "from-red-500/20 via-red-500/5 to-transparent",
      title: "EXPIRED — Do Not Purchase",
      subtitle: days !== null ? `Expired ${Math.abs(days)} day(s) ago` : "Product has passed expiry date",
    },
    unknown: {
      gradient: "from-slate-500/20 via-slate-500/5 to-transparent",
      title: "UNKNOWN — Date Not Verified",
      subtitle: "Could not determine expiry status",
    },
  };

  const banner = bannerConfig[status] || bannerConfig.unknown;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-lg mx-auto p-4 lg:p-8">
      {/* Status Banner */}
      <div className={`bg-gradient-to-b ${banner.gradient} rounded-2xl p-6 mb-6 text-center`}>
        <ExpiryStatusBadge status={status} daysUntilExpiry={days} size="lg" />
        <h1 className="text-xl font-bold text-white mt-4">{banner.title}</h1>
        <p className="text-slate-400 mt-1">{banner.subtitle}</p>
      </div>

      {/* Product Info */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 mb-4">
        <div className="flex items-start gap-4">
          {image && (
            <img src={image} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-semibold text-lg truncate">{name}</h2>
            {brand && <p className="text-slate-400 text-sm">{brand}</p>}
            {category && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-slate-800 rounded text-slate-400 text-xs">
                {category}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Date Details */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 mb-4">
        <h3 className="text-slate-400 text-sm font-medium mb-3">Date Information</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-slate-500 text-sm">Barcode</span>
            <span className="text-white text-sm font-mono">{barcode || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 text-sm">Manufacturing Date</span>
            <span className="text-white text-sm">{formatDate(mfg)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 text-sm">Expiry Date</span>
            <span className={`text-sm font-medium ${status === "expired" ? "text-red-400" : status === "expiring_soon" ? "text-amber-400" : "text-emerald-400"}`}>
              {formatDate(expiry)}
            </span>
          </div>
          {days !== null && (
            <div className="flex justify-between">
              <span className="text-slate-500 text-sm">Days Remaining</span>
              <span className={`text-sm font-bold ${days < 0 ? "text-red-400" : days <= 7 ? "text-amber-400" : "text-emerald-400"}`}>
                {days < 0 ? `${Math.abs(days)} days overdue` : `${days} days`}
              </span>
            </div>
          )}
          {confidence !== null && (
            <div className="flex justify-between items-center">
              <span className="text-slate-500 text-sm">OCR Confidence</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${confidence >= 70 ? "bg-emerald-400" : confidence >= 40 ? "bg-amber-400" : "bg-red-400"}`}
                    style={{ width: `${confidence}%` }}
                  />
                </div>
                <span className="text-slate-400 text-xs">{confidence}%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Share & Report */}
      {status === "expired" && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <h3 className="text-red-400 font-semibold text-sm mb-3">Report Expired Product</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                const msg = `EXPIRED PRODUCT ALERT!\n\nProduct: ${name}\nBarcode: ${barcode}\nExpiry: ${formatDate(expiry)}\nExpired: ${days ? Math.abs(days) : "?"} days ago\n\nScanned via ShelfLife Sentinel`;
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
              }}
              className="flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </button>
            <button
              onClick={() => {
                const msg = `EXPIRED PRODUCT ALERT! ${name} (Barcode: ${barcode}) expired ${days ? Math.abs(days) : "?"} days ago. Scanned via ShelfLife Sentinel.`;
                if (navigator.share) {
                  navigator.share({ title: "Expired Product Alert", text: msg });
                } else {
                  navigator.clipboard.writeText(msg);
                  alert("Copied to clipboard!");
                }
              }}
              className="flex items-center justify-center gap-2 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
              Share
            </button>
          </div>
          <a
            href="https://foscos.fssai.gov.in/consumer-grievance"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full mt-2 py-2.5 border border-red-500/30 hover:bg-red-500/10 text-red-400 text-sm font-medium rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
            </svg>
            Report to FSSAI
          </a>
        </div>
      )}

      {/* Share for non-expired */}
      {status !== "expired" && (
        <button
          onClick={() => {
            const statusText = status === "fresh" ? "FRESH" : "EXPIRING SOON";
            const msg = `Product Check: ${name}\nStatus: ${statusText}\nExpiry: ${formatDate(expiry)}${days !== null ? `\n${days > 0 ? days + " days remaining" : ""}` : ""}\n\nVerified via ShelfLife Sentinel`;
            if (navigator.share) {
              navigator.share({ title: "Product Freshness Check", text: msg });
            } else {
              window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
            }
          }}
          className="flex items-center justify-center gap-2 w-full py-2.5 border border-slate-700 hover:border-slate-600 text-slate-400 text-sm rounded-xl transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
          </svg>
          Share Result
        </button>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <Link
          href="/scan"
          className="flex items-center justify-center gap-2 w-full py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
          </svg>
          Scan Another Product
        </Link>
        <Link
          href="/dashboard"
          className="flex items-center justify-center w-full py-3 border border-slate-700 hover:border-slate-600 text-slate-300 font-medium rounded-xl transition-colors"
        >
          View Dashboard
        </Link>
      </div>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={
      <div className="max-w-lg mx-auto p-8 text-center">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    }>
      <ResultContent />
    </Suspense>
  );
}
