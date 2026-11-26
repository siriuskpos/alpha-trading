"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-card border border-line bg-card p-6 shadow-card">
      <p className="text-[13px] text-loss">{error.message || "This page hit an error."}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-3 rounded-ctl border border-line bg-hover px-3 py-1.5 text-[12px] font-semibold"
      >
        Try again
      </button>
    </div>
  );
}
