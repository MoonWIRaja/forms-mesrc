"use client";

import React, { useRef } from "react";

interface OtpBoxInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const BOX_COUNT = 4;

export default function OtpBoxInput({
  value,
  onChange,
  disabled = false,
}: OtpBoxInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: BOX_COUNT }, (_, i) => value[i] ?? "");

  function focusBox(index: number) {
    const target = inputsRef.current[index];
    if (target) {
      target.focus();
      target.select();
    }
  }

  function handleChange(index: number, raw: string) {
    const clean = raw.replace(/\D/g, "");
    if (!clean) {
      const next = [...digits];
      next[index] = "";
      onChange(next.join(""));
      return;
    }

    if (clean.length > 1) {
      handlePasteString(clean, index);
      return;
    }

    const next = [...digits];
    next[index] = clean[0];
    onChange(next.join(""));

    if (index < BOX_COUNT - 1) {
      focusBox(index + 1);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits];
        next[index] = "";
        onChange(next.join(""));
      } else if (index > 0) {
        const next = [...digits];
        next[index - 1] = "";
        onChange(next.join(""));
        focusBox(index - 1);
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && index > 0) {
      focusBox(index - 1);
      e.preventDefault();
    } else if (e.key === "ArrowRight" && index < BOX_COUNT - 1) {
      focusBox(index + 1);
      e.preventDefault();
    }
  }

  function handlePasteString(pasted: string, startIndex = 0) {
    const clean = pasted.replace(/\D/g, "").slice(0, BOX_COUNT);
    if (!clean) return;

    const next = Array.from({ length: BOX_COUNT }, (_, i) => value[i] ?? "");
    for (let i = 0; i < clean.length && startIndex + i < BOX_COUNT; i++) {
      next[startIndex + i] = clean[i];
    }
    onChange(next.join(""));

    const focusIdx = Math.min(startIndex + clean.length, BOX_COUNT - 1);
    window.setTimeout(() => focusBox(focusIdx), 10);
  }

  function handlePaste(index: number, e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    handlePasteString(pasted, index);
  }

  return (
    <div className="otp-wrapper">
      <div className="otp-box-row" role="group" aria-label="4-Digit One-Time Passcode">
        {digits.map((digit, idx) => (
          <input
            key={idx}
            ref={(el) => {
              inputsRef.current[idx] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            autoComplete={idx === 0 ? "one-time-code" : "off"}
            disabled={disabled}
            value={digit}
            aria-label={`Digit ${idx + 1} of 4`}
            className={`otp-digit-box ${digit ? "filled" : ""}`}
            onChange={(e) => handleChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            onPaste={(e) => handlePaste(idx, e)}
            onFocus={(e) => e.target.select()}
          />
        ))}
      </div>
    </div>
  );
}
