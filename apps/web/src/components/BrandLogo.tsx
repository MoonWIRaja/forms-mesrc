"use client";

import React from "react";
import { APP_NAME, BASE_PATH } from "@/lib/config";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  subtitle?: string;
}

export default function BrandLogo({ size = "md", subtitle }: BrandLogoProps) {
  const dim = size === "sm" ? 30 : size === "lg" ? 48 : 38;

  return (
    <div className={`brand-mark brand-mark-${size}`}>
      <div
        className="brand-mark-icon kbm-logo-frame"
        style={{ width: dim, height: dim }}
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${BASE_PATH}/icons/kbm-logo.png`}
          alt={APP_NAME}
          width={dim}
          height={dim}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        />
      </div>
      <div className="brand-mark-text">
        <span className="brand-mark-title">{APP_NAME}</span>
        {subtitle && <span className="brand-mark-sub">{subtitle}</span>}
      </div>
    </div>
  );
}
