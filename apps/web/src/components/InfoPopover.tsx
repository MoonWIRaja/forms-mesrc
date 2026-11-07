"use client";

import React from "react";

interface InfoPopoverProps {
  title: string;
  children: React.ReactNode;
}

export default function InfoPopover({ title, children }: InfoPopoverProps) {
  return (
    <span className="info-wrap" tabIndex={0} aria-label={title}>
      <span className="info-btn" aria-hidden="true">
        i
      </span>
      <div className="info-panel" role="tooltip">
        <div className="info-panel-header">
          <strong>{title}</strong>
        </div>
        <div className="info-panel-body">{children}</div>
      </div>
    </span>
  );
}
