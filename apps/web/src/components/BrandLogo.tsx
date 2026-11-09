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
        <rect width="64" height="64" rx="12" fill="#f3efe6" stroke="#1c1917" strokeWidth="3" />
        <rect x="15" y="14" width="36" height="41" rx="4" fill="#1c1917" />
        <rect
          x="11"
          y="10"
          width="36"
          height="41"
          rx="4"
          fill="#faf8f5"
          stroke="#1c1917"
          strokeWidth="3"
        />
        <rect x="12.5" y="11.5" width="33" height="7" fill="#fef3c7" />
        <line x1="11" y1="19" x2="47" y2="19" stroke="#1c1917" strokeWidth="2.8" />
        <path
          d="M18 38 V26 L24.5 33 L31 26 V38"
          fill="none"
          stroke="#1c1917"
          strokeWidth="3.5"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
        <rect x="35" y="26" width="6" height="5" fill="#1c1917" />
        <rect x="35" y="33.5" width="6" height="4.5" fill="#57534e" />
        <line
          x1="17"
          y1="44"
          x2="41"
          y2="44"
          stroke="#1c1917"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </svg>
      <div className="brand-mark-text">
        <span className="brand-mark-title">Forms MESRC</span>
        {subtitle && <span className="brand-mark-sub">{subtitle}</span>}
      </div>
    </div>
  );
}
