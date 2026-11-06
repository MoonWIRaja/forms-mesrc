"use client";

import { useState } from "react";

interface InfoPopoverProps {
  title: string;
  children: React.ReactNode;
}

export default function InfoPopover({ title, children }: InfoPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <span className="info-wrap">
      <button
        type="button"
        className="info-btn"
        aria-expanded={open}
        aria-label={`Instructions: ${title}`}
        onClick={() => setOpen((v) => !v)}
      >
        i
      </button>
      {open && (
        <div className="info-panel" role="region" aria-label={title}>
          <div className="info-panel-header">
            <strong>{title}</strong>
            <button
              type="button"
              className="btn-link"
              onClick={() => setOpen(false)}
              aria-label="Close instructions"
            >
              Close
            </button>
          </div>
          <div className="info-panel-body">{children}</div>
        </div>
      )}
    </span>
  );
}