"use client";

import React from "react";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  subtitle?: string;
}

export default function BrandLogo({ size = "md", subtitle }: BrandLogoProps) {
  const dim = size === "sm" ? 28 : size === "lg" ? 44 : 36;

  return (
    <div className={`brand-mark brand-mark-${size}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 64 64"
        width={dim}
        height={dim}
        aria-hidden="true"
        className="brand-mark-icon"
      >
        <defs>
          <linearGradient id="mesrc-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="14" fill="url(#mesrc-bg)" />
        {/* Back accent sheet */}
        <rect x="19" y="12" width="32" height="40" rx="6" fill="#2563eb" opacity="0.85" />
        {/* Front document card */}
        <rect x="13" y="14" width="34" height="40" rx="6" fill="#ffffff" />
        {/* Header stripe */}
        <rect x="19" y="21" width="14" height="3.5" rx="1.75" fill="#2563eb" />
        {/* Monogram M & lines */}
        <path
          d="M19 41 V30 L25 36.5 L31 30 V41"
          fill="none"
          stroke="#0f172a"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="35" y="30" width="6" height="3.2" rx="1.6" fill="#64748b" />
        <rect x="35" y="36.5" width="6" height="3.2" rx="1.6" fill="#94a3b8" />
        <rect x="19" y="46" width="22" height="2.6" rx="1.3" fill="#cbd5e1" />
      </svg>
      <div className="brand-mark-text">
        <span className="brand-mark-title">Forms MESRC</span>
        {subtitle && <span className="brand-mark-sub">{subtitle}</span>}
      </div>
    </div>
  );
}
