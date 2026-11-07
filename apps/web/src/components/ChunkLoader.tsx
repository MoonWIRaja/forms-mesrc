"use client";

import React from "react";

interface ChunkLoaderProps {
  title?: string;
  subtitle?: string;
  variant?: "chunk" | "skeleton" | "both";
}

export default function ChunkLoader({
  title = "GENERATING WORLD CHUNKS...",
  subtitle = "Unfolding 3D paper journal pages & syncing blocks",
  variant = "both",
}: ChunkLoaderProps) {
  return (
    <section className="card journal-page chunk-loader-card" aria-busy="true" aria-live="polite">
      {/* Decorative masking tape & stamps */}
      <div className="paper-tape paper-tape-tl" aria-hidden="true" />
      <div className="paper-tape paper-tape-tr" aria-hidden="true" />

      <div className="chunk-loader-header">
        {/* Custom Voxel Book / Isometric Cube SVG Icon */}
        <div className="voxel-badge" aria-hidden="true">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Hard neo-brutal shadow block */}
            <polygon points="24,6 42,15 42,35 24,44 6,35 6,15" fill="#18181b" />
            {/* Top face */}
            <polygon points="22,4 40,13 22,22 4,13" fill="#fde047" stroke="#18181b" strokeWidth="2.5" strokeLinejoin="round" />
            {/* Left face */}
            <polygon points="4,13 22,22 22,41 4,32" fill="#4ade80" stroke="#18181b" strokeWidth="2.5" strokeLinejoin="round" />
            {/* Right face */}
            <polygon points="22,22 40,13 40,32 22,41" fill="#38bdf8" stroke="#18181b" strokeWidth="2.5" strokeLinejoin="round" />
            {/* Inner pixel detail */}
            <rect x="19" y="10" width="6" height="4" fill="#18181b" />
          </svg>
        </div>

        <div>
          <span className="brutal-tag tag-yellow">CHUNK_LOADER &bull; ACTIVE</span>
          <h2 className="chunk-title">{title}</h2>
          <p className="notice" style={{ margin: 0 }}>{subtitle}</p>
        </div>
      </div>

      {(variant === "chunk" || variant === "both") && (
        <div className="chunk-stage" aria-hidden="true">
          <div className="chunk-grid">
            {Array.from({ length: 16 }).map((_, idx) => (
              <div
                key={idx}
                className={`chunk-cell chunk-cell-${(idx % 4) + 1}`}
                style={{ animationDelay: `${idx * 65}ms` }}
              >
                <span className="chunk-coord">
                  {Math.floor(idx / 4)},{idx % 4}
                </span>
              </div>
            ))}
          </div>

          <div className="chunk-progress-wrap">
            <div className="chunk-progress-label">
              <span>TERRAIN &amp; JOURNAL PAGES</span>
              <span className="chunk-blink">LOADING [■■■■■■□□] 75%</span>
            </div>
            <div className="chunk-progress-bar">
              <div className="chunk-progress-fill" />
            </div>
          </div>
        </div>
      )}

      {(variant === "skeleton" || variant === "both") && (
        <div className="skeleton-journal-stack" aria-hidden="true">
          <div className="skeleton-row">
            <div className="skeleton-block skel-avatar" />
            <div className="skeleton-col">
              <div className="skeleton-block skel-line-lg" />
              <div className="skeleton-block skel-line-sm" />
            </div>
            <div className="skeleton-block skel-stamp" />
          </div>
          <div className="skeleton-block skel-card-body" />
          <div className="skeleton-actions">
            <div className="skeleton-block skel-btn" />
            <div className="skeleton-block skel-btn-sec" />
          </div>
        </div>
      )}
    </section>
  );
}
