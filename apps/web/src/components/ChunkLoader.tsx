"use client";

import React from "react";

interface ChunkLoaderProps {
  title?: string;
  subtitle?: string;
  variant?: "chunk" | "skeleton" | "both";
}

export default function ChunkLoader({
  title = "Loading workspace...",
  subtitle = "Preparing journal data",
}: ChunkLoaderProps) {
  return (
    <section className="card stack" aria-busy="true" aria-live="polite">
      <div className="loader-header">
        <div className="chunk-mini-grid" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, idx) => (
            <span
              key={idx}
              className="chunk-dot"
              style={{ animationDelay: `${idx * 90}ms` }}
            />
          ))}
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{title}</h2>
          <p className="notice" style={{ fontSize: "0.88rem" }}>{subtitle}</p>
        </div>
      </div>

      <div className="skeleton-stack" aria-hidden="true">
        <div className="skeleton-line" style={{ width: "62%" }} />
        <div className="skeleton-line" style={{ width: "88%" }} />
        <div className="skeleton-line" style={{ width: "45%", height: "32px", marginTop: "0.35rem" }} />
      </div>
    </section>
  );
}
