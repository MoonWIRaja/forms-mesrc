"use client";

import React, { useEffect, useRef, useState } from "react";

interface ScoreWheelPickerProps {
  id: string;
  value: number | null;
  maxMarks: number;
  accentColor?: string;
  disabled?: boolean;
  onChange: (val: number) => void;
}

const ITEM_HEIGHT = 42;

export default function ScoreWheelPicker({
  id,
  value,
  maxMarks,
  accentColor = "#0f5132",
  disabled = false,
  onChange,
}: ScoreWheelPickerProps) {
  const safeMax = Math.max(1, Math.min(200, Math.round(maxMarks || 25)));
  const [open, setOpen] = useState(false);
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const scrollTimerRef = useRef<number | null>(null);

  const options = Array.from({ length: safeMax + 1 }, (_, i) => i);
  const currentNum = value !== null && !Number.isNaN(value) ? Math.max(0, Math.min(safeMax, value)) : null;

  useEffect(() => {
    if (!open || !wheelRef.current) return;
    const targetVal = currentNum ?? Math.round(safeMax * 0.6);
    wheelRef.current.scrollTop = targetVal * ITEM_HEIGHT;
  }, [open, currentNum, safeMax]);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
    };
  }, []);

  function handleWheelScroll() {
    if (!wheelRef.current || disabled) return;
    if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = window.setTimeout(() => {
      if (!wheelRef.current) return;
      const idx = Math.round(wheelRef.current.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(safeMax, idx));
      if (clamped !== currentNum) {
        onChange(clamped);
      }
    }, 65);
  }

  function selectValue(next: number) {
    if (disabled) return;
    const clamped = Math.max(0, Math.min(safeMax, next));
    onChange(clamped);
    if (wheelRef.current) {
      wheelRef.current.scrollTo({ top: clamped * ITEM_HEIGHT, behavior: "smooth" });
    }
  }

  return (
    <div className="sw-wrap" id={id}>
      <div className="sw-trigger-row">
        <button
          type="button"
          className={`sw-display-btn ${open ? "open" : ""} ${currentNum !== null ? "scored" : ""}`}
          style={
            open
              ? { borderColor: accentColor, boxShadow: `2px 2px 0 ${accentColor}` }
              : undefined
          }
          disabled={disabled}
          onClick={() => {
            if (!open && currentNum === null) {
              onChange(Math.round(safeMax * 0.6));
            }
            setOpen((prev) => !prev);
          }}
        >
          <span className="sw-display-left">
            <span className="sw-value-big" style={{ color: currentNum !== null ? accentColor : "var(--muted)" }}>
              {currentNum !== null ? currentNum : "—"}
            </span>
            <span className="sw-max-slash">/ {safeMax}</span>
          </span>
          <span className="sw-action-hint">{open ? "Done ▴" : "Scroll Score ▾"}</span>
        </button>

        <div className="sw-stepper-group">
          <button
            type="button"
            className="sw-step-btn"
            disabled={disabled || (currentNum !== null && currentNum <= 0)}
            aria-label="Decrease score"
            onClick={() => selectValue((currentNum ?? 1) - 1)}
          >
            &minus;
          </button>
          <button
            type="button"
            className="sw-step-btn"
            disabled={disabled || (currentNum !== null && currentNum >= safeMax)}
            aria-label="Increase score"
            onClick={() => selectValue((currentNum ?? 0) + 1)}
          >
            +
          </button>
        </div>
      </div>

      {open && !disabled && (
        <div className="sw-drum-drawer" role="listbox" aria-label={`Score out of ${safeMax}`}>
          <div className="sw-drum-fade-top" aria-hidden="true" />
          <div
            className="sw-drum-center-band"
            style={{ borderColor: accentColor }}
            aria-hidden="true"
          >
            <span className="sw-drum-unit">/ {safeMax}</span>
          </div>
          <div className="sw-drum-fade-bottom" aria-hidden="true" />

          <div
            ref={wheelRef}
            className="sw-drum-scroller"
            onScroll={handleWheelScroll}
          >
            <div style={{ height: ITEM_HEIGHT }} aria-hidden="true" />
            {options.map((n) => {
              const isSelected = n === currentNum;
              return (
                <button
                  key={n}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`sw-drum-item ${isSelected ? "selected" : ""}`}
                  style={isSelected ? { color: accentColor } : undefined}
                  onClick={() => selectValue(n)}
                >
                  {n}
                </button>
              );
            })}
            <div style={{ height: ITEM_HEIGHT }} aria-hidden="true" />
          </div>
        </div>
      )}
    </div>
  );
}
