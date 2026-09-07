"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import ImageCapture from "@/components/ImageCapture";
import { scanBarcode, scanOCR, scanOCRImage, completeScan } from "@/lib/api";
import { extractText } from "@/lib/ocr";
import { isGS1Barcode, parseGS1Barcode } from "@/lib/gs1";
import type { BarcodeLookupResult, OCRResult } from "@/lib/types";

const BarcodeScanner = dynamic(() => import("@/components/BarcodeScanner"), {
  ssr: false,
  loading: () => (
    <div className="h-64 bg-slate-800/50 rounded-xl animate-pulse flex items-center justify-center">
      <p className="text-slate-500">Loading scanner...</p>
    </div>
  ),
});

type Step = "barcode" | "expiry" | "confirm" | "processing";

export default function ScanPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("barcode");
  const [barcodeValue, setBarcodeValue] = useState("");
  const [manualBarcode, setManualBarcode] = useState("");
  const [productInfo, setProductInfo] = useState<BarcodeLookupResult["product"] | null>(null);
  const [productNotFound, setProductNotFound] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualBrand, setManualBrand] = useState("");
  const [manualCategory, setManualCategory] = useState("");
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [ocrProgress, setOcrProgress] = useState<string | null>(null);
  const [manualMfg, setManualMfg] = useState("");
  const [manualExpiry, setManualExpiry] = useState("");
  const [manualBatch, setManualBatch] = useState("");
  const [bestBeforeMonths, setBestBeforeMonths] = useState("");
  const [dateMode, setDateMode] = useState<"expiry" | "pkd">("expiry");
  const [gs1Detected, setGs1Detected] = useState(false);
  const [showOCR, setShowOCR] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBarcodeScanned = useCallback(async (barcode: string) => {
    setLoading(true);
    setError(null);
    setGs1Detected(false);

    // Check if this is a GS1-128 barcode with embedded dates
    if (isGS1Barcode(barcode)) {
      const gs1Data = parseGS1Barcode(barcode);
      const lookupBarcode = gs1Data.barcode || barcode;
      setBarcodeValue(lookupBarcode);
      setGs1Detected(true);

      if (gs1Data.mfgDate) setManualMfg(gs1Data.mfgDate);
      if (gs1Data.expiryDate) setManualExpiry(gs1Data.expiryDate);
      if (gs1Data.batchNumber) setManualBatch(gs1Data.batchNumber);

      try {
        const result = await scanBarcode(barcode);
        if (result.found && result.product) {
          setProductInfo(result.product);
          setProductNotFound(false);
        } else {
          setProductNotFound(true);
        }
      } catch {
        setProductNotFound(true);
      }

      // GS1 has dates — skip OCR, go straight to confirm
      if (gs1Data.expiryDate) {
        setStep("confirm");
      } else {
        setStep("expiry");
      }
      setLoading(false);
      return;
    }

    // Standard EAN-13/UPC barcode — no dates inside
    setBarcodeValue(barcode);
    try {
      const result = await scanBarcode(barcode);
      if (result.found && result.product) {
        setProductInfo(result.product);
        setProductNotFound(false);
      } else {
        setProductNotFound(true);
      }
      setStep("expiry");
    } catch {
      setError("Failed to look up barcode. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleManualBarcodeSubmit = useCallback(() => {
    if (manualBarcode.trim()) {
      handleBarcodeScanned(manualBarcode.trim());
    }
  }, [manualBarcode, handleBarcodeScanned]);

  const handleImageCapture = useCallback(async (file: File) => {
    setLoading(true);
    setOcrProgress("Analyzing image...");
    setError(null);
    try {
      // Try Gemini Vision first (server-side, most accurate)
      setOcrProgress("Sending to AI Vision...");
      const geminiResult = await scanOCRImage(file);
      if (geminiResult.expiry_date || geminiResult.mfg_date) {
        setOcrResult(geminiResult);
        if (geminiResult.mfg_date) setManualMfg(geminiResult.mfg_date.split("T")[0]);
        if (geminiResult.expiry_date) setManualExpiry(geminiResult.expiry_date.split("T")[0]);
        setStep("confirm");
        return;
      }

      // Fall back to Tesseract.js (client-side)
      setOcrProgress("AI Vision unavailable. Using on-device OCR...");
      const rawText = await extractText(file, setOcrProgress);
      if (!rawText.trim()) {
        setError("No text detected. Try a clearer image or enter dates manually.");
        setLoading(false);
        return;
      }
      const parsed = await scanOCR(rawText);
      setOcrResult(parsed);
      if (parsed.mfg_date) setManualMfg(parsed.mfg_date.split("T")[0]);
      if (parsed.expiry_date) setManualExpiry(parsed.expiry_date.split("T")[0]);
      setStep("confirm");
    } catch {
      setError("OCR failed. Please enter dates manually.");
    } finally {
      setLoading(false);
      setOcrProgress(null);
    }
  }, []);

  const handleSkipOCR = () => {
    setStep("confirm");
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await completeScan({
        barcode: barcodeValue,
        name: productInfo?.name || manualName || undefined,
        brand: productInfo?.brand || manualBrand || undefined,
        category: productInfo?.category || manualCategory || undefined,
        mfg_date: manualMfg || undefined,
        expiry_date: manualExpiry || undefined,
        best_before_months: bestBeforeMonths ? parseInt(bestBeforeMonths) : ocrResult?.best_before_months || undefined,
        batch_number: manualBatch || undefined,
        image_url: productInfo?.image_url || undefined,
        scan_type: gs1Detected ? "gs1" : ocrResult ? "both" : "barcode",
        confidence: gs1Detected ? 100 : ocrResult?.confidence || undefined,
        raw_ocr_text: ocrResult?.raw_text || undefined,
      });
      router.push(`/result?scanId=${result.scan_id}&status=${result.status}&days=${result.days_until_expiry ?? ""}&name=${encodeURIComponent(result.product.name || "")}&barcode=${result.product.barcode}&mfg=${result.product.mfg_date || ""}&expiry=${result.product.expiry_date || ""}&brand=${encodeURIComponent(result.product.brand || "")}&category=${encodeURIComponent(result.product.category || "")}&image=${encodeURIComponent(result.product.image_url || "")}&confidence=${result.confidence ?? ""}&scanType=${gs1Detected ? "gs1" : "standard"}`);
    } catch {
      setError("Failed to complete scan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-4 lg:p-8">
      <h1 className="text-2xl font-bold text-white mb-2">Scan Product</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {["Barcode", "Expiry Date", "Confirm"].map((label, i) => {
          const stepIndex = ["barcode", "expiry", "confirm"].indexOf(step);
          const isActive = i <= stepIndex;
          return (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                isActive ? "bg-cyan-500 text-white" : "bg-slate-800 text-slate-500"
              }`}>
                {i + 1}
              </div>
              <span className={`text-xs ${isActive ? "text-cyan-400" : "text-slate-500"}`}>{label}</span>
              {i < 2 && <div className={`flex-1 h-px ${isActive ? "bg-cyan-500/30" : "bg-slate-800"}`} />}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Step 1: Barcode */}
      {step === "barcode" && (
        <div className="space-y-4">
          <BarcodeScanner
            isActive={true}
            onScanSuccess={handleBarcodeScanned}
          />
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#020617] px-3 text-sm text-slate-500">or enter manually</span>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter barcode or GS1-128 data"
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleManualBarcodeSubmit()}
              className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
            <button
              onClick={handleManualBarcodeSubmit}
              disabled={!manualBarcode.trim() || loading}
              className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-xl transition-colors"
            >
              {loading ? "..." : "Go"}
            </button>
          </div>
          <p className="text-slate-600 text-xs text-center">
            Supports EAN-13, UPC, QR codes, and GS1-128 barcodes with embedded dates
          </p>
        </div>
      )}

      {/* Step 2: Expiry Date */}
      {step === "expiry" && (
        <div className="space-y-4">
          {productInfo && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center gap-4">
              {productInfo.image_url && (
                <img src={productInfo.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
              )}
              <div>
                <p className="text-white font-medium">{productInfo.name}</p>
                {productInfo.brand && <p className="text-slate-400 text-sm">{productInfo.brand}</p>}
                <p className="text-slate-500 text-xs">Barcode: {barcodeValue}</p>
              </div>
            </div>
          )}

          {productNotFound && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-3">
              <p className="text-amber-400 text-sm font-medium">Product not found in database. Enter details:</p>
              <input
                type="text"
                placeholder="Product name *"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500/50"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Brand"
                  value={manualBrand}
                  onChange={(e) => setManualBrand(e.target.value)}
                  className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500/50"
                />
                <input
                  type="text"
                  placeholder="Category"
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value)}
                  className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>
          )}

          {/* Date Entry - Primary */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h2 className="text-white font-semibold mb-3">Enter Date from Packaging</h2>
            <p className="text-slate-400 text-xs mb-4">Look at the packet and enter the date printed on it</p>

            {/* Mode toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setDateMode("expiry")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                  dateMode === "expiry"
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                    : "bg-slate-900/50 text-slate-400 border border-slate-700"
                }`}
              >
                Has EXP / Use By date
              </button>
              <button
                onClick={() => setDateMode("pkd")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                  dateMode === "pkd"
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                    : "bg-slate-900/50 text-slate-400 border border-slate-700"
                }`}
              >
                Has PKD + Best Before
              </button>
            </div>

            {dateMode === "expiry" ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1">MFG / PKD Date (optional)</label>
                  <input
                    type="date"
                    value={manualMfg}
                    onChange={(e) => setManualMfg(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Expiry / Use By Date *</label>
                  <input
                    type="date"
                    value={manualExpiry}
                    onChange={(e) => setManualExpiry(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1">PKD / Packed Date *</label>
                  <input
                    type="date"
                    value={manualMfg}
                    onChange={(e) => setManualMfg(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Best Before *</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "3 mo", value: "3" },
                      { label: "6 mo", value: "6" },
                      { label: "9 mo", value: "9" },
                      { label: "12 mo", value: "12" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setBestBeforeMonths(opt.value);
                          if (manualMfg) {
                            const mfg = new Date(manualMfg);
                            mfg.setMonth(mfg.getMonth() + parseInt(opt.value));
                            setManualExpiry(mfg.toISOString().split("T")[0]);
                          }
                        }}
                        className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                          bestBeforeMonths === opt.value
                            ? "bg-cyan-500 text-white"
                            : "bg-slate-900/50 text-slate-400 border border-slate-700 hover:border-slate-600"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {manualMfg && bestBeforeMonths && manualExpiry && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 text-center">
                    <p className="text-emerald-400 text-sm">
                      Computed expiry: <span className="font-semibold">{new Date(manualExpiry).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</span>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setStep("confirm")}
            disabled={!manualExpiry}
            className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-colors"
          >
            Check Expiry Status
          </button>

          {/* OCR option - secondary */}
          {!showOCR ? (
            <button
              onClick={() => setShowOCR(true)}
              className="w-full py-2 text-slate-500 hover:text-slate-300 text-xs transition-colors"
            >
              Or try auto-detect from photo (experimental)
            </button>
          ) : (
            <div className="border border-slate-800 rounded-xl p-3">
              <p className="text-slate-500 text-xs mb-2">Auto-detect (works best with clear, close-up photos)</p>
              {ocrProgress && (
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-2 mb-2 flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-cyan-400 text-xs">{ocrProgress}</p>
                </div>
              )}
              <ImageCapture isActive={true} onCapture={handleImageCapture} />
            </div>
          )}
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === "confirm" && (
        <div className="space-y-4">
          {/* GS1 success banner */}
          {gs1Detected && manualExpiry && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-emerald-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-emerald-400 font-medium text-sm">GS1-128 Barcode Detected</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  Dates extracted directly from barcode — 100% accuracy. No OCR needed.
                </p>
              </div>
            </div>
          )}

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-white font-medium mb-3">Verify Dates</h3>
            {ocrResult && !gs1Detected && (
              <div className="bg-slate-900/50 rounded-lg p-3 mb-3">
                <p className="text-slate-400 text-xs mb-1">OCR detected text:</p>
                <p className="text-slate-300 text-sm font-mono">{ocrResult.raw_text}</p>
                <p className="text-slate-500 text-xs mt-1">Confidence: {ocrResult.confidence}%</p>
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 text-sm mb-1">Manufacturing Date</label>
                <input
                  type="date"
                  value={manualMfg}
                  onChange={(e) => setManualMfg(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={manualExpiry}
                  onChange={(e) => setManualExpiry(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              {manualBatch && (
                <div>
                  <label className="block text-slate-400 text-sm mb-1">Batch Number</label>
                  <input
                    type="text"
                    value={manualBatch}
                    onChange={(e) => setManualBatch(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !manualExpiry}
            className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              "Check Expiry Status"
            )}
          </button>

          <button
            onClick={() => { setGs1Detected(false); setStep("expiry"); }}
            className="w-full py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors"
          >
            Back to capture
          </button>
        </div>
      )}
    </div>
  );
}
