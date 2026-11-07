"use client";

import type { FormFieldNode, FormTheme } from "@/lib/form-types";

interface FormRendererProps {
  nodes: FormFieldNode[];
  theme?: FormTheme;
  answers: Record<string, unknown>;
  onChange: (fieldId: string, value: unknown, file?: File) => void;
  disabled?: boolean;
}

const ALLOWED_COLORS = new Set(["#1d4ed8", "#0f766e", "#7c3aed", "#b45309", "#be123c", "#111827"]);

export default function FormRenderer({
  nodes,
  theme,
  answers,
  onChange,
  disabled = false,
}: FormRendererProps) {
  const accent =
    theme?.primaryColor && ALLOWED_COLORS.has(theme.primaryColor) ? theme.primaryColor : "#1d4ed8";

  return (
    <div
      className="stack"
      style={{
        ["--primary" as string]: accent,
        gap: theme?.density === "compact" ? "0.65rem" : "1.1rem",
      }}
    >
      {nodes.map((node) => {
        if (node.type === "heading") {
          return (
            <h3 key={node.id} style={{ margin: "0.5rem 0 0", color: accent }}>
              {node.label}
            </h3>
          );
        }
        if (node.type === "instructions") {
          return (
            <p key={node.id} className="notice" style={{ margin: 0 }}>
              {node.label}
            </p>
          );
        }
        if (node.type === "section") {
          return (
            <hr
              key={node.id}
              style={{ border: 0, borderTop: "2px solid var(--border)", margin: "0.5rem 0" }}
            />
          );
        }

        const val = answers[node.id];
        const strVal = typeof val === "string" ? val : "";

        return (
          <div key={node.id} className="field">
            <label htmlFor={`fld-${node.id}`}>
              <span>
                {node.label}
                {node.required && <span style={{ color: "#dc2626" }}> *</span>}
              </span>
            </label>
            {node.helpText && (
              <span className="notice" style={{ fontSize: "0.84rem" }}>
                {node.helpText}
              </span>
            )}

            {node.type === "short_text" && (
              <input
                id={`fld-${node.id}`}
                type="text"
                required={node.required}
                disabled={disabled}
                placeholder={node.placeholder ?? ""}
                value={strVal}
                onChange={(e) => onChange(node.id, e.target.value)}
              />
            )}

            {node.type === "email" && (
              <input
                id={`fld-${node.id}`}
                type="email"
                required={node.required}
                disabled={disabled}
                placeholder={node.placeholder ?? "name@company.com"}
                value={strVal}
                onChange={(e) => onChange(node.id, e.target.value)}
              />
            )}

            {node.type === "number" && (
              <input
                id={`fld-${node.id}`}
                type="number"
                required={node.required}
                disabled={disabled}
                placeholder={node.placeholder ?? ""}
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

            {node.type === "long_text" && (
              <textarea
                id={`fld-${node.id}`}
                rows={4}
                required={node.required}
                disabled={disabled}
                placeholder={node.placeholder ?? ""}
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
              <div className="stack" style={{ gap: "0.35rem" }}>
                {(node.options ?? []).map((opt) => (
                  <label
                    key={opt}
                    style={{ fontWeight: 400, display: "flex", alignItems: "center", gap: "0.5rem" }}
                  >
                    <input
                      type="radio"
                      name={`radio-${node.id}`}
                      required={node.required}
                      disabled={disabled}
                      checked={strVal === opt}
                      onChange={() => onChange(node.id, opt)}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}

            {node.type === "multiple_choice" && (
              <div className="stack" style={{ gap: "0.35rem" }}>
                {(node.options ?? []).map((opt) => {
                  const arr = Array.isArray(val) ? (val as string[]) : [];
                  const checked = arr.includes(opt);
                  return (
                    <label
                      key={opt}
                      style={{
                        fontWeight: 400,
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
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
                      {opt}
                    </label>
                  );
                })}
              </div>
            )}

            {node.type === "file_upload" && (
              <div className="card" style={{ padding: "0.75rem", background: "#f8fafc" }}>
                <input
                  id={`fld-${node.id}`}
                  type="file"
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
                    onChange(node.id, {
                      name: f.name,
                      size: f.size,
                      type: f.type || "application/octet-stream",
                    }, f);
                  }}
                />
                <p className="notice" style={{ margin: "0.35rem 0 0", fontSize: "0.82rem" }}>
                  Maximum file size: 1 GiB (stored in Google Workspace Shared Drive{" "}
                  <code>Forms MESRC/&#123;user_id&#125;/&#123;submission_id&#125;</code>).
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
