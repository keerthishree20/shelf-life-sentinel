"use client";

import { useEffect, useRef, useState } from "react";

interface BarcodeScannerProps {
  onScanSuccess: (barcode: string) => void;
  onScanError?: (error: string) => void;
  isActive: boolean;
}

export default function BarcodeScanner({ onScanSuccess, onScanError, isActive }: BarcodeScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<unknown>(null);
  const isRunningRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const hasScanned = useRef(false);

  useEffect(() => {
    if (!isActive || !scannerRef.current) return;

    let mounted = true;
    hasScanned.current = false;
    isRunningRef.current = false;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted) return;

        const scannerId = "barcode-scanner-region";
        if (!document.getElementById(scannerId)) return;

        const html5QrCode = new Html5Qrcode(scannerId);
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 280, height: 150 },
            aspectRatio: 1.0,
          },
          (decodedText: string) => {
            if (!hasScanned.current) {
              hasScanned.current = true;
              onScanSuccess(decodedText);
              if (isRunningRef.current) {
                isRunningRef.current = false;
                html5QrCode.stop().catch(() => {});
              }
            }
          },
          () => {}
        );
        isRunningRef.current = true;
        setError(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Camera access denied";
        setError(msg);
        onScanError?.(msg);
      }
    }

    startScanner();

    return () => {
      mounted = false;
      if (isRunningRef.current) {
        isRunningRef.current = false;
        const scanner = html5QrCodeRef.current as { stop?: () => Promise<void>; clear?: () => void } | null;
        if (scanner?.stop) {
          scanner.stop().then(() => {
            scanner.clear?.();
          }).catch(() => {});
        }
      }
    };
  }, [isActive, onScanSuccess, onScanError]);

  if (!isActive) return null;

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-red-400 mx-auto mb-3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <p className="text-red-400 font-medium mb-2">Camera Access Required</p>
        <p className="text-slate-400 text-sm">
          Please allow camera access in your browser settings to scan barcodes.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        id="barcode-scanner-region"
        ref={scannerRef}
        className="rounded-xl overflow-hidden bg-black"
      />
      <div className="text-center mt-3">
        <p className="text-slate-400 text-sm">Point camera at the product barcode</p>
      </div>
    </div>
  );
}
