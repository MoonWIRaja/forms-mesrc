"use client";

import React, { useRef, useState } from "react";

interface OtpBoxInputProps {
  value: string;
  onChange: (value: string) => void;
  defaultLength?: 4 | 6 | 8;
  disabled?: boolean;
}

export default function OtpBoxInput({
  value,
  onChange,
  defaultLength = 4,
  disabled = false,
}: OtpBoxInputProps) {
  const [boxCount, setBoxCount] = useState<4 | 6 | 8>(
    value.length > 6 ? 8 : value.length > 4 ? 6 : defaultLength,
  );
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const digits = Array.from({ length: boxCount }, (_, i) => value[i] ?? "");

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

    // If user typed or pasted multiple digits into a single box
    if (clean.length > 1) {
      handlePasteString(clean, index);
      return;
    }

    const next = [...digits];
    next[index] = clean[0];
    onChange(next.join(""));

    if (index < boxCount - 1) {
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
    } else if (e.key === "ArrowRight" && index < boxCount - 1) {
      focusBox(index + 1);
      e.preventDefault();
    }
  }

  function handlePasteString(pasted: string, startIndex = 0) {
    const clean = pasted.replace(/\D/g, "");
    if (!clean) return;

    // Auto-adapt box count to match the pasted OTP length (4, 6, or 8 digits)
    const targetLen: 4 | 6 | 8 = clean.length > 6 ? 8 : clean.length > 4 ? 6 : boxCount;
    if (targetLen !== boxCount) {
      setBoxCount(targetLen);
    }

    const next = Array.from({ length: targetLen }, (_, i) => value[i] ?? "");
    for (let i = 0; i < clean.length && startIndex + i < targetLen; i++) {
      next[startIndex + i] = clean[i];
    }
    const joined = next.join("");
    onChange(joined);

    const focusIdx = Math.min(startIndex + clean.length, targetLen - 1);
    window.setTimeout(() => focusBox(focusIdx), 10);
  }

  function handlePaste(index: number, e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    handlePasteString(pasted, index);
  }

  function toggleLength(newLen: 4 | 6 | 8) {
    setBoxCount(newLen);
    onChange(value.slice(0, newLen));
  }

  return (
    <div className="otp-wrapper">
      <div className="otp-box-row" role="group" aria-label="One-Time Passcode Digits">
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
            aria-label={`Digit ${idx + 1}`}
            className={`otp-digit-box ${digit ? "filled" : ""}`}
            onChange={(e) => handleChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            onPaste={(e) => handlePaste(idx, e)}
            onFocus={(e) => e.target.select()}
          />
        ))}
      </div>

      <div className="otp-mode-switch">
        <span className="notice" style={{ fontSize: "0.78rem" }}>
          Boxes:
        </span>
        <button
          type="button"
          className={`otp-len-btn ${boxCount === 4 ? "active" : ""}`}
          onClick={() => toggleLength(4)}
        >
          4
        </button>
        <button
          type="button"
          className={`otp-len-btn ${boxCount === 6 ? "active" : ""}`}
          onClick={() => toggleLength(6)}
        >
          6
        </button>
        <button
          type="button"
          className={`otp-len-btn ${boxCount === 8 ? "active" : ""}`}
          onClick={() => toggleLength(8)}
        >
          8
        </button>
      </div>
    </div>
  );
}
