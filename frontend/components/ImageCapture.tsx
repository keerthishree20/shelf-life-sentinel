"use client";

import { useRef, useState, useCallback } from "react";

interface ImageCaptureProps {
  onCapture: (file: File) => void;
  isActive: boolean;
}

export default function ImageCapture({ onCapture, isActive }: ImageCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capturedBlobRef = useRef<Blob | null>(null);
  const [mode, setMode] = useState<"camera" | "upload">("camera");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setCameraError(null);
      }
    } catch {
      setCameraError("Camera access denied. Please allow camera permissions.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const captureImage = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    stopCamera();

    canvas.toBlob(
      (blob) => {
        if (blob) {
          capturedBlobRef.current = blob;
          const url = URL.createObjectURL(blob);
          setPreview(url);
        }
      },
      "image/jpeg",
      0.95
    );
  }, [stopCamera]);

  const confirmCapture = useCallback(() => {
    const blob = capturedBlobRef.current;
    if (!blob) return;
    const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    capturedBlobRef.current = null;
    onCapture(file);
  }, [onCapture, preview]);

  const retakePhoto = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    capturedBlobRef.current = null;
    startCamera();
  }, [startCamera, preview]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onCapture(file);
    },
    [onCapture]
  );

  if (!isActive) return null;

  return (
    <div>
      {/* Tips banner */}
      <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3 mb-4">
        <p className="text-cyan-400 text-xs font-medium mb-1">Tips for best results:</p>
        <ul className="text-slate-400 text-xs space-y-0.5">
          <li>• Zoom in close — only the date area, not the full packet</li>
          <li>• Good lighting — avoid shadows on the text</li>
          <li>• Hold steady — blurry text won't be readable</li>
        </ul>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setMode("camera"); setPreview(null); if (!cameraActive) startCamera(); }}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            mode === "camera"
              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
              : "bg-slate-800/50 text-slate-400 border border-slate-700"
          }`}
        >
          Camera
        </button>
        <button
          onClick={() => { setMode("upload"); setPreview(null); stopCamera(); }}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            mode === "upload"
              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
              : "bg-slate-800/50 text-slate-400 border border-slate-700"
          }`}
        >
          Upload Image
        </button>
      </div>

      {mode === "camera" && (
        <div className="relative">
          {cameraError ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
              <p className="text-red-400 text-sm">{cameraError}</p>
            </div>
          ) : preview ? (
            <div>
              <img src={preview} alt="Captured" className="w-full rounded-xl" />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={retakePhoto}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-colors"
                >
                  Retake
                </button>
                <button
                  onClick={confirmCapture}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors"
                >
                  Use This Photo
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative">
                <video
                  ref={videoRef}
                  className="w-full rounded-xl bg-black"
                  playsInline
                  muted
                />
                {cameraActive && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="border-2 border-cyan-400/60 border-dashed rounded-lg w-[70%] h-[40%] flex items-center justify-center">
                      <span className="bg-black/60 text-cyan-400 text-xs px-2 py-1 rounded">
                        Align date text here
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />
              {!cameraActive ? (
                <button
                  onClick={startCamera}
                  className="w-full mt-3 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-xl transition-colors"
                >
                  Start Camera
                </button>
              ) : (
                <button
                  onClick={captureImage}
                  className="w-full mt-3 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors"
                >
                  Capture
                </button>
              )}
            </>
          )}
        </div>
      )}

      {mode === "upload" && (
        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-700 rounded-xl cursor-pointer hover:border-cyan-500/50 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-slate-500 mb-2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-slate-400 text-sm">Upload a close-up photo of the expiry date</p>
          <p className="text-slate-500 text-xs mt-1">JPG, PNG supported</p>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileUpload}
          />
        </label>
      )}
    </div>
  );
}
