import Link from "next/link";

const features = [
  {
    title: "Instant Barcode Scan",
    description: "Point your camera at any product barcode for instant identification using on-device decoding.",
    icon: "M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z",
    color: "text-cyan-400 bg-cyan-500/10",
  },
  {
    title: "AI-Powered Date Reading",
    description: "On-device OCR reads manufacturing and expiry dates directly from packaging — no internet needed.",
    icon: "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
    color: "text-violet-400 bg-violet-500/10",
  },
  {
    title: "Smart Expiry Alerts",
    description: "Get instant color-coded results and automated alerts for retailers when products approach expiry.",
    icon: "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0",
    color: "text-amber-400 bg-amber-500/10",
  },
];

const steps = [
  { step: "1", title: "Scan Barcode", description: "Point your phone camera at the product barcode" },
  { step: "2", title: "Capture Date", description: "Take a photo of the MFG/EXP date on the packaging" },
  { step: "3", title: "Get Result", description: "Instantly know if the product is fresh, expiring, or expired" },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 pt-20 pb-16 lg:pt-32 lg:pb-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 flex items-center justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-cyan-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4 max-w-xl">
          ShelfLife Sentinel
        </h1>
        <p className="text-lg lg:text-xl text-slate-400 mb-8 max-w-lg">
          Verify expiration dates instantly. Protect consumers. Empower retailers.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/scan"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
            Scan a Product
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-8 py-3.5 border border-slate-700 hover:border-slate-500 text-slate-300 font-medium rounded-xl transition-colors"
          >
            Retailer Dashboard
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-16 lg:pb-24 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
              <div className={`w-10 h-10 rounded-lg ${f.color} flex items-center justify-center mb-4`}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section className="px-6 pb-16 lg:pb-24 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-white text-center mb-10">How It Works</h2>
        <div className="flex flex-col md:flex-row items-start gap-6">
          {steps.map((s, i) => (
            <div key={s.step} className="flex-1 text-center relative">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center mx-auto mb-3">
                {s.step}
              </div>
              <h3 className="text-white font-semibold mb-1">{s.title}</h3>
              <p className="text-slate-400 text-sm">{s.description}</p>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-5 left-[60%] w-[80%] h-px bg-slate-800" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Edge AI Badge */}
      <section className="px-6 pb-20 max-w-2xl mx-auto text-center">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 font-medium text-sm">Powered by Edge AI</span>
          </div>
          <p className="text-slate-400 text-sm">
            All scanning and OCR processing happens on your device. No data sent to the cloud.
            Works offline. Zero API keys required. Truly private.
          </p>
        </div>
      </section>
    </div>
  );
}
