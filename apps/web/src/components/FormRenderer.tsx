"use client";

import { useState } from "react";
import {
  computePageScoreSummary,
  getLocalNowParts,
  resolveKbmAccent,
  splitDateTimeValue,
  splitNodesIntoPages,
  type FormFieldNode,
  type FormTheme,
} from "@/lib/form-types";
import {
  PixelArrowLeftIcon,
  PixelArrowRightIcon,
  PixelClipIcon,
  PixelImageIcon,
  PixelLockIcon,
  PixelRefreshIcon,
  PixelStarIcon,
  PixelStarOutlineIcon,
} from "./PixelIcons";
import ScoreWheelPicker from "./ScoreWheelPicker";

interface FormRendererProps {
  nodes: FormFieldNode[];
  theme?: FormTheme;
  answers: Record<string, unknown>;
  onChange: (fieldId: string, value: unknown, file?: File) => void;
  disabled?: boolean;
  compactCards?: boolean;
  activePageIndex?: number;
  onPageChange?: (pageIndex: number) => void;
}

export default function FormRenderer({
  nodes,
  theme,
  answers,
  onChange,
  disabled = false,
  compactCards = false,
  activePageIndex,
  onPageChange,
}: FormRendererProps) {
  const accent = resolveKbmAccent(theme?.primaryColor, theme?.category);
  const [hoveredStar, setHoveredStar] = useState<Record<string, number>>({});
  const [internalPageIdx, setInternalPageIdx] = useState(0);

  const pages = splitNodesIntoPages(nodes, theme);
  const isMultiPage = pages.length > 1;
  const isControlledPage = typeof activePageIndex === "number";
  const currentPageIdx = Math.min(
    Math.max(0, isControlledPage ? activePageIndex : internalPageIdx),
    pages.length - 1,
  );
  const currentPage = pages[currentPageIdx] ?? pages[0];
  const visibleNodes = isMultiPage
    ? currentPage.items.map((item) => item.node)
    : nodes;

  function handleSelectPage(targetIdx: number) {
    const clamped = Math.min(Math.max(0, targetIdx), pages.length - 1);
    if (onPageChange) {
      onPageChange(clamped);
    } else {
      setInternalPageIdx(clamped);
    }
  }

  return (
    <div
      className="fr-questions-stack"
      style={{
        ["--primary" as string]: accent,
        gap: compactCards || theme?.density === "compact" ? "0.65rem" : "0.85rem",
      }}
    >
      {visibleNodes.map((node) => {
        if (node.type === "heading") {
          return (
            <div key={node.id} className="fr-section-heading" style={{ borderLeft: `4px solid ${accent}` }}>
              <h3 style={{ margin: 0, color: accent }}>{node.label}</h3>
              {node.helpText && (
                <p className="notice" style={{ margin: "0.2rem 0 0", fontSize: "0.82rem" }}>
                  {node.helpText}
                </p>
              )}
            </div>
          );
        }

        if (node.type === "instructions") {
          return (
            <div key={node.id} className="fr-instructions-card">
              <p className="notice" style={{ margin: 0, color: "var(--ink-secondary)" }}>
                {node.helpText || node.label}
              </p>
            </div>
          );
        }

        if (node.type === "section") {
          return (
            <hr
              key={node.id}
              style={{ border: 0, borderTop: "2px dashed var(--border-strong)", margin: "0.25rem 0" }}
            />
          );
        }

        if (node.type === "image") {
          return (
            <div key={node.id} className="fr-question-card">
              {node.label && (
                <div className="fr-question-label" style={{ marginBottom: "0.45rem" }}>
                  {node.label}
                </div>
              )}
              {node.imageUrl ? (
                <figure style={{ margin: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={node.imageUrl}
                    alt={node.caption || node.label || "Form graphic"}
                    className="fr-embedded-image"
                  />
                  {(node.caption || node.helpText) && (
                    <figcaption className="notice" style={{ marginTop: "0.4rem", fontSize: "0.8rem" }}>
                      {node.caption || node.helpText}
                    </figcaption>
                  )}
                </figure>
              ) : (
                <div className="gf-file-upload-mock">
                  <PixelImageIcon size={20} />
                  <span className="gf-file-sub">No image selected yet.</span>
                </div>
              )}
            </div>
          );
        }

        const val = answers[node.id];
        const strVal = typeof val === "string" ? val : "";
        const numVal = typeof val === "number" ? val : Number(strVal) || 0;
        const isDateTimeType =
          node.type === "date" || node.type === "time" || node.type === "date_time";

        if (node.type === "score_total") {
          const summary = computePageScoreSummary(visibleNodes, answers);
          const hasManualOverride =
            Boolean(node.allowManualOverride) &&
            val !== undefined &&
            val !== null &&
            val !== "" &&
            !Number.isNaN(Number(val));
          const displayTotal = hasManualOverride ? Number(val) : summary.total;
          const pct =
            summary.maxTotal > 0
              ? Math.min(100, Math.round((displayTotal / summary.maxTotal) * 100))
              : 0;

          return (
            <div
              key={node.id}
              className="fr-question-card fr-total-score-card"
              style={{ borderLeft: `6px solid ${accent}` }}
            >
              <div className="fr-question-top">
                <span className="fr-question-label">{node.label}</span>
                <span className="pixel-stamp-badge live">
                  {hasManualOverride ? "MANUAL" : "AUTO"}
                </span>
              </div>
              {node.helpText && <span className="fr-help-text">{node.helpText}</span>}

              <div className="fr-total-score-hero">
                <span className="fr-total-score-num" style={{ color: accent }}>
                  {displayTotal}
                </span>
                <span className="fr-total-score-den">/ {summary.maxTotal || 100}</span>
              </div>

              <div className="fr-page-progress-track">
                <div
                  className="fr-page-progress-fill"
                  style={{ width: `${pct}%`, backgroundColor: accent }}
                />
              </div>

              <div className="row-between" style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                <span>
                  {summary.pendingCount > 0
                    ? `Pending scores: ${summary.pendingCount}`
                    : `All ${summary.totalScorable} criteria scored`}
                </span>
                <strong>{pct}%</strong>
              </div>

              {node.allowManualOverride && !disabled && (
                <div className="fr-manual-override-row">
                  <label htmlFor={`fld-${node.id}`} className="fr-mini-label">
                    Manual Override (Leave empty for Auto)
                  </label>
                  <input
                    id={`fld-${node.id}`}
                    type="number"
                    min={0}
                    max={summary.maxTotal || 100}
                    placeholder={`Auto (${summary.total})`}
                    value={hasManualOverride ? String(val) : ""}
                    onChange={(e) =>
                      onChange(
                        node.id,
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                  />
                </div>
              )}
            </div>
          );
        }

        return (
          <div key={node.id} className="fr-question-card field">
            <div className="fr-question-top">
              <label htmlFor={`fld-${node.id}`} className="fr-question-label">
                <span>
                  {node.label}
                  {node.required && <span className="fr-req-mark"> *</span>}
                </span>
              </label>

              {node.type === "score_wheel" && (
                <span className="pixel-tag-pill">Max. {node.maxMarks ?? 25}</span>
              )}

              {node.readOnly && (
                <span className="pixel-tag-pill" title="Verified / Fixed Field">
                  <PixelLockIcon size={10} />
                  <span>Fixed</span>
                </span>
              )}

              {isDateTimeType && !disabled && (
                <button
                  type="button"
                  className="fr-now-pill"
                  title="Reset to current live date/time"
                  onClick={() => {
                    const now = getLocalNowParts();
                    onChange(
                      node.id,
                      node.type === "date"
                        ? now.date
                        : node.type === "time"
                          ? now.time
                          : now.dateTime,
                    );
                  }}
                >
                  <PixelRefreshIcon size={11} />
                  <span>{node.type === "date" ? "Today" : "Now"}</span>
                </button>
              )}
            </div>

            {node.helpText && (
              <span className="fr-help-text">{node.helpText}</span>
            )}

            {node.type === "score_wheel" && (
              <ScoreWheelPicker
                id={`fld-${node.id}`}
                value={
                  val === undefined || val === null || val === ""
                    ? null
                    : Number(val)
                }
                maxMarks={node.maxMarks ?? 25}
                accentColor={accent}
                disabled={disabled}
                onChange={(nextScore) => onChange(node.id, nextScore)}
              />
            )}

            {node.type === "short_text" && (
              <input
                id={`fld-${node.id}`}
                type="text"
                required={node.required}
                disabled={disabled}
                readOnly={Boolean(node.readOnly)}
                style={
                  node.readOnly
                    ? { background: "var(--surface-muted)", color: "var(--ink-secondary)", fontWeight: 700 }
                    : undefined
                }
                placeholder={node.placeholder ?? "Your answer"}
                value={strVal}
                onChange={(e) => {
                  if (!node.readOnly) onChange(node.id, e.target.value);
                }}
              />
            )}

            {node.type === "email" && (
              <input
                id={`fld-${node.id}`}
                type="email"
                required={node.required}
                disabled={disabled}
                readOnly={Boolean(node.readOnly)}
                style={
                  node.readOnly
                    ? { background: "var(--surface-muted)", color: "var(--ink-secondary)", fontWeight: 700 }
                    : undefined
                }
                placeholder={node.placeholder ?? "name@company.com"}
                value={strVal}
                onChange={(e) => {
                  if (!node.readOnly) onChange(node.id, e.target.value);
                }}
              />
            )}

            {node.type === "number" && (
              <input
                id={`fld-${node.id}`}
                type="number"
                required={node.required}
                disabled={disabled}
                placeholder={node.placeholder ?? "0"}
                value={strVal}
                onChange={(e) => onChange(node.id, e.target.value)}
              />
            )}

            {node.type === "date" && (
              <input
                id={`fld-${node.id}`}
                type="date"
                required={node.required}
                disabled={disabled}
                value={strVal}
                onChange={(e) => onChange(node.id, e.target.value)}
              />
            )}

            {node.type === "time" && (
              <input
                id={`fld-${node.id}`}
                type="time"
                required={node.required}
                disabled={disabled}
                value={strVal}
                onChange={(e) => onChange(node.id, e.target.value)}
              />
            )}

            {node.type === "date_time" && (() => {
              const parsed = splitDateTimeValue(strVal);
              const fallbackNow = getLocalNowParts();
              const curDate = parsed.date || (node.defaultToNow !== false ? fallbackNow.date : "");
              const curTime = parsed.time || (node.defaultToNow !== false ? fallbackNow.time : "");
              return (
                <div className="fr-datetime-grid">
                  <div className="fr-datetime-sub">
                    <span className="fr-mini-label">Date</span>
                    <input
                      id={`fld-${node.id}`}
                      type="date"
                      required={node.required}
                      disabled={disabled}
                      value={curDate}
                      onChange={(e) => {
                        const nextDate = e.target.value;
                        const nextTime = curTime || getLocalNowParts().time;
                        onChange(node.id, nextDate ? `${nextDate} ${nextTime}` : "");
                      }}
                    />
                  </div>
                  <div className="fr-datetime-sub">
                    <span className="fr-mini-label">Time</span>
                    <input
                      type="time"
                      required={node.required}
                      disabled={disabled}
                      value={curTime}
                      onChange={(e) => {
                        const nextTime = e.target.value;
                        const nextDate = curDate || getLocalNowParts().date;
                        onChange(node.id, nextTime ? `${nextDate} ${nextTime}` : "");
                      }}
                    />
                  </div>
                </div>
              );
            })()}

            {node.type === "long_text" && (
              <textarea
                id={`fld-${node.id}`}
                rows={3}
                required={node.required}
                disabled={disabled}
                placeholder={node.placeholder ?? "Enter your response..."}
                value={strVal}
                onChange={(e) => onChange(node.id, e.target.value)}
              />
            )}

            {node.type === "dropdown" && (
              <select
                id={`fld-${node.id}`}
                required={node.required}
                disabled={disabled}
                value={strVal}
                onChange={(e) => onChange(node.id, e.target.value)}
              >
                <option value="">Select an option...</option>
                {(node.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}

            {node.type === "single_choice" && (
              <div className="fr-choices-list">
                {(node.options ?? []).map((opt) => (
                  <label
                    key={opt}
                    className={`fr-choice-option ${strVal === opt ? "selected" : ""}`}
                    style={
                      strVal === opt
                        ? { borderColor: accent, background: `${accent}10` }
                        : undefined
                    }
                  >
                    <input
                      type="radio"
                      name={`radio-${node.id}`}
                      required={node.required}
                      disabled={disabled}
                      checked={strVal === opt}
                      onChange={() => onChange(node.id, opt)}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            )}

            {node.type === "multiple_choice" && (
              <div className="fr-choices-list">
                {(node.options ?? []).map((opt) => {
                  const arr = Array.isArray(val) ? (val as string[]) : [];
                  const checked = arr.includes(opt);
                  return (
                    <label
                      key={opt}
                      className={`fr-choice-option ${checked ? "selected" : ""}`}
                      style={
                        checked
                          ? { borderColor: accent, background: `${accent}10` }
                          : undefined
                      }
                    >
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...arr, opt]
                            : arr.filter((x) => x !== opt);
                          onChange(node.id, next);
                        }}
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {node.type === "star_rating" && (() => {
              const maxStars = node.maxRating && node.maxRating > 1 ? node.maxRating : 5;
              const hoverVal = hoveredStar[node.id] ?? 0;
              const activeVal = hoverVal || numVal;
              return (
                <div className="fr-rating-wrap">
                  <div
                    className="fr-stars-row"
                    onMouseLeave={() => setHoveredStar((prev) => ({ ...prev, [node.id]: 0 }))}
                  >
                    {Array.from({ length: maxStars }, (_, i) => i + 1).map((starNum) => {
                      const filled = starNum <= activeVal;
                      return (
                        <button
                          key={starNum}
                          type="button"
                          disabled={disabled}
                          className={`fr-star-btn ${filled ? "filled" : ""}`}
                          style={filled ? { color: "#d97706" } : undefined}
                          onMouseEnter={() => {
                            if (!disabled) setHoveredStar((prev) => ({ ...prev, [node.id]: starNum }));
                          }}
                          onClick={() => onChange(node.id, starNum)}
                          aria-label={`Rate ${starNum} of ${maxStars} stars`}
                        >
                          {filled ? (
                            <PixelStarIcon size={26} />
                          ) : (
                            <PixelStarOutlineIcon size={26} />
                          )}
                        </button>
                      );
                    })}
                    <span className="pixel-stamp-badge draft" style={{ marginLeft: "0.35rem" }}>
                      {numVal > 0 ? `${numVal} / ${maxStars}` : "RATE"}
                    </span>
                  </div>
                  {(node.ratingLabels?.low || node.ratingLabels?.high) && (
                    <div className="fr-rating-labels">
                      <span>1 = {node.ratingLabels?.low || "Low"}</span>
                      <span>{maxStars} = {node.ratingLabels?.high || "Excellent"}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {node.type === "linear_scale" && (() => {
              const minVal = node.minRating ?? 1;
              const maxVal = node.maxRating && node.maxRating > minVal ? node.maxRating : 10;
              const steps = Array.from({ length: maxVal - minVal + 1 }, (_, i) => minVal + i);
              return (
                <div className="fr-rating-wrap">
                  <div className="fr-scale-row">
                    {steps.map((stepNum) => {
                      const active = val === stepNum || strVal === String(stepNum);
                      return (
                        <button
                          key={stepNum}
                          type="button"
                          disabled={disabled}
                          className={`fr-scale-tile ${active ? "active" : ""}`}
                          style={
                            active
                              ? { backgroundColor: accent, color: "#fff", borderColor: "var(--ink)" }
                              : undefined
                          }
                          onClick={() => onChange(node.id, stepNum)}
                        >
                          {stepNum}
                        </button>
                      );
                    })}
                  </div>
                  {(node.ratingLabels?.low || node.ratingLabels?.high) && (
                    <div className="fr-rating-labels">
                      <span>{minVal} = {node.ratingLabels?.low || "Low"}</span>
                      <span>{maxVal} = {node.ratingLabels?.high || "High"}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {node.type === "file_upload" && (() => {
              const fileMeta =
                val && typeof val === "object" && "name" in val
                  ? (val as { name: string; size?: number })
                  : null;
              const sizeLabel =
                fileMeta?.size && fileMeta.size > 0
                  ? fileMeta.size >= 1048576
                    ? `${(fileMeta.size / 1048576).toFixed(1)} MB`
                    : `${Math.max(1, Math.round(fileMeta.size / 1024))} KB`
                  : null;
              return (
                <div className="fr-file-picker-box">
                  <input
                    id={`fld-${node.id}`}
                    type="file"
                    className="sr-only"
                    disabled={disabled}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) {
                        onChange(node.id, null, undefined);
                        return;
                      }
                      if (f.size > 1073741824) {
                        window.alert("File exceeds the 1 GiB maximum limit.");
                        e.target.value = "";
                        return;
                      }
                      onChange(
                        node.id,
                        {
                          name: f.name,
                          size: f.size,
                          type: f.type || "application/octet-stream",
                        },
                        f,
                      );
                    }}
                  />

                  <div className="fr-file-picker-header">
                    <div className="fr-file-picker-title">
                      <PixelClipIcon size={15} />
                      <span>{fileMeta ? "Attached File" : "Attach Supporting File"}</span>
                    </div>
                    <label
                      htmlFor={`fld-${node.id}`}
                      className={`pixel-paper-btn compact primary fr-file-picker-btn ${
                        disabled ? "disabled" : ""
                      }`}
                      style={{ backgroundColor: accent }}
                    >
                      <span>{fileMeta ? "Replace File" : "Choose File"}</span>
                    </label>
                  </div>

                  {fileMeta ? (
                    <div className="fr-file-selected-row">
                      <div className="fr-file-selected-name">
                        <strong>{fileMeta.name}</strong>
                        {sizeLabel && <span className="notice"> ({sizeLabel})</span>}
                      </div>
                      {!disabled && (
                        <button
                          type="button"
                          className="pixel-paper-btn compact"
                          onClick={() => onChange(node.id, null, undefined)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="fr-file-picker-hint">
                      Tap Choose File to attach PDF, image, or document (max 1 GiB).
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })}

      {isMultiPage && !isControlledPage && (
        <div className="fr-preview-page-nav">
          <button
            type="button"
            className="pixel-paper-btn compact"
            disabled={currentPageIdx === 0}
            onClick={() => handleSelectPage(currentPageIdx - 1)}
          >
            <PixelArrowLeftIcon size={12} />
            <span>Previous Page</span>
          </button>

          <span className="pixel-tag-pill">
            Page {currentPage.pageNumber} / {pages.length}
          </span>

          <button
            type="button"
            className="pixel-paper-btn compact primary"
            style={{ backgroundColor: accent }}
            disabled={currentPageIdx >= pages.length - 1}
            onClick={() => handleSelectPage(currentPageIdx + 1)}
          >
            <span>Next Page</span>
            <PixelArrowRightIcon size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
