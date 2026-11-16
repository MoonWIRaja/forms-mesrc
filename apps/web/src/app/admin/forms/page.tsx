"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import ChunkLoader from "@/components/ChunkLoader";
import {
  FORM_TEMPLATES,
  type FieldType,
  type FormFieldNode,
  type FormKind,
  type FormRow,
  type FormTheme,
  type ServiceRow,
} from "@/lib/form-types";
import { getSupabase, type UserProfile } from "@/lib/supabase";

const FIELD_TYPE_OPTIONS: { type: FieldType; label: string; icon: string }[] = [
  { type: "short_text", label: "Short Text", icon: "≡" },
  { type: "long_text", label: "Paragraph / Long Text", icon: "¶" },
  { type: "dropdown", label: "Dropdown Select", icon: "▾" },
  { type: "single_choice", label: "Multiple Choice (Radio)", icon: "◉" },
  { type: "multiple_choice", label: "Checkboxes", icon: "☑" },
  { type: "date", label: "Date", icon: "📅" },
  { type: "email", label: "Email Address", icon: "@" },
  { type: "number", label: "Number", icon: "#" },
  { type: "file_upload", label: "File Upload (Drive)", icon: "📎" },
  { type: "heading", label: "Section Heading", icon: "T" },
  { type: "instructions", label: "Helper / Instructions", icon: "ℹ" },
  { type: "section", label: "Divider Line", icon: "—" },
];

const THEME_ACCENTS = [
  { name: "Royal Blue", hex: "#1d4ed8" },
  { name: "Teal Emerald", hex: "#0f766e" },
  { name: "Deep Violet", hex: "#7c3aed" },
  { name: "Warm Amber", hex: "#b45309" },
  { name: "Rose Crimson", hex: "#be123c" },
  { name: "Obsidian Slate", hex: "#18181b" },
];

export default function AdminFormBuilderPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [forms, setForms] = useState<FormRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Metadata State
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [title, setTitle] = useState("New Company Form");
  const [slug, setSlug] = useState("new-company-form");
  const [description, setDescription] = useState("Please fill out this form with accurate information.");
  const [kind, setKind] = useState<FormKind>("general");
  const [allowSaveDraft, setAllowSaveDraft] = useState(true);
  const [allowAppeal, setAllowAppeal] = useState(false);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [allowlistText, setAllowlistText] = useState("");
  const [nodes, setNodes] = useState<FormFieldNode[]>(FORM_TEMPLATES[0].nodes);
  const [theme, setTheme] = useState<FormTheme>({
    primaryColor: "#1d4ed8",
    cardRadius: "rounded",
    density: "comfortable",
  });

  // Studio UI Navigation State
  const [activeTab, setActiveTab] = useState<"questions" | "preview" | "catalog" | "settings">("questions");
  const [previewDevice, setPreviewDevice] = useState<"phone" | "desktop">("phone");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(FORM_TEMPLATES[0].nodes[0]?.id ?? null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const seqRef = useRef(1);

  // Full-bleed studio breakout
  useEffect(() => {
    const frame = document.querySelector(".app-frame");
    const shell = document.querySelector(".shell");
    frame?.classList.add("studio-mode");
    shell?.classList.add("studio-mode");
    return () => {
      frame?.classList.remove("studio-mode");
      shell?.classList.remove("studio-mode");
    };
  }, []);

  // Initial Data Fetch
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        if (!uid) return;
        const [{ data: prof }, { data: fRows }, { data: sRows }] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
          supabase.from("forms").select("*").order("updated_at", { ascending: false }),
          supabase.from("services").select("*").order("sort_order", { ascending: true }),
        ]);
        if (!active) return;
        setProfile((prof as UserProfile | null) ?? null);
        setForms((fRows as FormRow[] | null) ?? []);
        setServices((sRows as ServiceRow[] | null) ?? []);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function refreshFormsList() {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("forms")
      .select("*")
      .order("updated_at", { ascending: false });
    setForms((data as FormRow[] | null) ?? []);
  }

  async function handleSelectExistingForm(f: FormRow) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const supabase = getSupabase();
      const [{ data: ver }, { data: fSvcs }, { data: allowRows }] = await Promise.all([
        supabase
          .from("form_versions")
          .select("*")
          .eq("form_id", f.id)
          .eq("version_number", f.latest_version)
          .maybeSingle(),
        supabase.from("form_services").select("service_id").eq("form_id", f.id),
        supabase.from("form_email_allowlist").select("email").eq("form_id", f.id),
      ]);

      setSelectedFormId(f.id);
      setTitle(f.title);
      setSlug(f.slug);
      setDescription(f.description);
      setKind(f.kind);
      setAllowSaveDraft(f.allow_save_draft);
      setAllowAppeal(f.allow_appeal);
      setSelectedServices(
        ((fSvcs as { service_id: string }[] | null) ?? []).map((x) => x.service_id),
      );
      setAllowlistText(
        ((allowRows as { email: string }[] | null) ?? []).map((x) => x.email).join("\n"),
      );
      if (ver) {
        const parsedNodes = ((ver as { schema_json: FormFieldNode[] }).schema_json ?? []) as FormFieldNode[];
        setNodes(parsedNodes);
        setSelectedNodeId(parsedNodes[0]?.id ?? null);
        setTheme(((ver as { theme_json: FormTheme }).theme_json ?? {}) as FormTheme);
      }
      setActiveTab("questions");
      setInfo(`Loaded form "${f.title}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load form.");
    } finally {
      setBusy(false);
    }
  }

  function handleLoadTemplate(tplKey: string) {
    const tpl = FORM_TEMPLATES.find((t) => t.key === tplKey);
    if (!tpl) return;
    setSelectedFormId(null);
    setTitle(tpl.title);
    seqRef.current += 1;
    setSlug(`${tpl.slug}-${forms.length + seqRef.current}`);
    setDescription(tpl.description);
    setKind(tpl.kind);
    setAllowAppeal(tpl.allowAppeal);
    const cloned = tpl.nodes.map((n) => ({ ...n }));
    setNodes(cloned);
    setSelectedNodeId(cloned[0]?.id ?? null);
    setActiveTab("questions");
    setInfo(`Loaded template: ${tpl.name}`);
  }

  function updateNode(nodeId: string, patch: Partial<FormFieldNode>) {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)));
  }

  function handleAddNode(type: FieldType = "short_text") {
    seqRef.current += 1;
    const id = `fld_${nodes.length + seqRef.current}`;
    const defaultOptions =
      type === "dropdown" || type === "single_choice" || type === "multiple_choice"
        ? ["Option 1", "Option 2", "Option 3"]
        : undefined;

    const newNode: FormFieldNode = {
      id,
      type,
      label:
        type === "heading"
          ? "New Section Header"
          : type === "instructions"
            ? "Instructions for applicant"
            : type === "section"
              ? "Section Break"
              : `Untitled Question`,
      required: false,
      options: defaultOptions,
      width: "full",
    };

    // Insert after selected node, or append at end
    const selectedIdx = nodes.findIndex((n) => n.id === selectedNodeId);
    if (selectedIdx !== -1) {
      const updated = [...nodes];
      updated.splice(selectedIdx + 1, 0, newNode);
      setNodes(updated);
    } else {
      setNodes((prev) => [...prev, newNode]);
    }
    setSelectedNodeId(id);
  }

  function handleDuplicateNode(nodeToCopy: FormFieldNode) {
    seqRef.current += 1;
    const newId = `fld_${nodes.length + seqRef.current}`;
    const cloned: FormFieldNode = {
      ...nodeToCopy,
      id: newId,
      label: `${nodeToCopy.label} (Copy)`,
      options: nodeToCopy.options ? [...nodeToCopy.options] : undefined,
    };
    const idx = nodes.findIndex((n) => n.id === nodeToCopy.id);
    const updated = [...nodes];
    updated.splice(idx + 1, 0, cloned);
    setNodes(updated);
    setSelectedNodeId(newId);
  }

  function handleMoveNode(fromIdx: number, toIdx: number) {
    if (toIdx < 0 || toIdx >= nodes.length || fromIdx === toIdx) return;
    const copy = [...nodes];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    setNodes(copy);
  }

  function handleDeleteNode(id: string) {
    const idx = nodes.findIndex((n) => n.id === id);
    const remaining = nodes.filter((n) => n.id !== id);
    setNodes(remaining);
    if (selectedNodeId === id) {
      const nextSelected = remaining[idx] ?? remaining[idx - 1] ?? null;
      setSelectedNodeId(nextSelected ? nextSelected.id : null);
    }
  }

  // Inline Option Helpers
  function handleAddOption(nodeId: string) {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== nodeId) return n;
        const currentOpts = n.options ?? [];
        return {
          ...n,
          options: [...currentOpts, `Option ${currentOpts.length + 1}`],
        };
      }),
    );
  }

  function handleUpdateOption(nodeId: string, optIdx: number, val: string) {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== nodeId) return n;
        const opts = [...(n.options ?? [])];
        opts[optIdx] = val;
        return { ...n, options: opts };
      }),
    );
  }

  function handleRemoveOption(nodeId: string, optIdx: number) {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== nodeId) return n;
        const opts = (n.options ?? []).filter((_, i) => i !== optIdx);
        return { ...n, options: opts };
      }),
    );
  }

  async function handleSaveDraft() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const supabase = getSupabase();
      const allowEmails = allowlistText
        .split(/[\n,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      const { data, error: rpcErr } = await supabase.rpc("save_form_builder", {
        p_form_id: selectedFormId,
        p_slug: slug,
        p_title: title,
        p_description: description,
        p_kind: kind,
        p_allow_save_draft: allowSaveDraft,
        p_allow_appeal: allowAppeal,
        p_service_ids: selectedServices,
        p_allowlist_emails: allowEmails,
        p_schema_json: nodes,
        p_theme_json: theme,
      });
      if (rpcErr) throw rpcErr;
      const res = data as { form_id: string; slug: string; latest_version: number };
      setSelectedFormId(res.form_id);
      setSlug(res.slug);
      setInfo(`Saved draft version v${res.latest_version}.`);
      await refreshFormsList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save form draft.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const supabase = getSupabase();
      const allowEmails = allowlistText
        .split(/[\n,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      const { data: saveRes, error: saveErr } = await supabase.rpc("save_form_builder", {
        p_form_id: selectedFormId,
        p_slug: slug,
        p_title: title,
        p_description: description,
        p_kind: kind,
        p_allow_save_draft: allowSaveDraft,
        p_allow_appeal: allowAppeal,
        p_service_ids: selectedServices,
        p_allowlist_emails: allowEmails,
        p_schema_json: nodes,
        p_theme_json: theme,
      });
      if (saveErr) throw saveErr;
      const formId = (saveRes as { form_id: string }).form_id;
      setSelectedFormId(formId);

      const { data: pubData, error: pubErr } = await supabase.rpc("publish_form_version", {
        p_form_id: formId,
      });
      if (pubErr) throw pubErr;
      const pRes = pubData as { published_version: number };
      setInfo(`Published version v${pRes.published_version} is now LIVE for members!`);
      await refreshFormsList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish form version.");
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive(formId: string) {
    if (!confirm("Are you sure you want to archive this form?")) return;
    setBusy(true);
    try {
      const supabase = getSupabase();
      const { error: rpcErr } = await supabase.rpc("archive_form", { p_form_id: formId });
      if (rpcErr) throw rpcErr;
      setInfo("Form archived successfully.");
      await refreshFormsList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive form.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <ChunkLoader title="Form Studio" subtitle="Loading Google Forms layout..." />;
  }

  if (!profile || (profile.role !== "admin" && profile.role !== "maintenance")) {
    return (
      <div className="center-stage">
        <section className="card stack">
          <h1>Access Restricted</h1>
          <p className="notice">Only Admin or Maintenance accounts may access the Form Studio.</p>
          <div className="row-actions">
            <Link href="/" className="btn btn-primary">
              Return Home
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const currentFormRecord = forms.find((f) => f.id === selectedFormId);
  const primaryAccent = theme.primaryColor || "#1d4ed8";

  return (
    <div className="gf-studio-shell">
      {/* ======================================================================
          TOP COMMAND BAR (GOOGLE FORMS / TALLY STYLE)
          ====================================================================== */}
      <header className="gf-studio-toolbar" aria-label="Studio Command Bar">
        <div className="gf-toolbar-left">
          <Link href="/admin/" className="btn btn-secondary gf-exit-btn" title="Exit to Submissions Dashboard">
            &larr; Exit
          </Link>
          <div className="gf-brand-badge" title="Forms MESRC Studio">
            <BrandLogo size="sm" />
            <span className="gf-brand-name">Forms MESRC</span>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="gf-title-input"
            title="Click to rename form title"
            placeholder="Form Title..."
          />
          <span
            className={`badge ${
              currentFormRecord?.state === "published"
                ? "badge-configured"
                : "badge-not_configured"
            }`}
          >
            {currentFormRecord
              ? `v${currentFormRecord.latest_version} (${currentFormRecord.state})`
              : "New Draft"}
          </span>
        </div>

        {/* CENTER NAVIGATION TABS */}
        <div className="gf-toolbar-center">
          <nav className="gf-nav-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "questions"}
              className={`gf-tab-btn ${activeTab === "questions" ? "active" : ""}`}
              onClick={() => setActiveTab("questions")}
            >
              <span className="gf-tab-icon">📝</span>
              <span>Questions</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "preview"}
              className={`gf-tab-btn ${activeTab === "preview" ? "active" : ""}`}
              onClick={() => setActiveTab("preview")}
            >
              <span className="gf-tab-icon">👁️</span>
              <span>Live Preview</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "catalog"}
              className={`gf-tab-btn ${activeTab === "catalog" ? "active" : ""}`}
              onClick={() => setActiveTab("catalog")}
            >
              <span className="gf-tab-icon">📋</span>
              <span>Catalog ({forms.length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "settings"}
              className={`gf-tab-btn ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              <span className="gf-tab-icon">⚙️</span>
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* RIGHT ACTIONS */}
        <div className="gf-toolbar-right">
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: "0.45rem 0.85rem", fontSize: "0.82rem" }}
            disabled={busy}
            onClick={handleSaveDraft}
          >
            {busy ? "Saving..." : "Save Draft"}
          </button>
          <button
            type="button"
            className="btn btn-accent"
            style={{ padding: "0.45rem 0.95rem", fontSize: "0.82rem" }}
            disabled={busy}
            onClick={handlePublish}
          >
            Publish Live &rarr;
          </button>
        </div>
      </header>

      {error && (
        <p className="alert alert-error gf-floating-alert" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="alert alert-ok gf-floating-alert" role="status">
          {info}
        </p>
      )}

      {/* ======================================================================
          VIEW 1: QUESTIONS EDITOR STREAM (GOOGLE FORMS INLINE CARD STREAM)
          ====================================================================== */}
      {activeTab === "questions" && (
        <main className="gf-editor-stage" aria-label="Questions Document Stream">
          <div className="gf-document-stream">
            {/* 1. FORM HEADER CARD (TITLE, DESCRIPTION, THEME ACCENT) */}
            <div
              className="gf-header-card"
              style={{ borderTop: `8px solid ${primaryAccent}` }}
            >
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Form Title..."
                className="gf-header-title-input"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Form description and applicant guidelines..."
                className="gf-header-desc-input"
                rows={2}
              />

              <div className="gf-header-footer">
                <div className="gf-theme-picker">
                  <span className="gf-theme-label">Theme Color:</span>
                  <div className="gf-theme-swatches">
                    {THEME_ACCENTS.map((acc) => (
                      <button
                        key={acc.hex}
                        type="button"
                        className={`gf-swatch-dot ${theme.primaryColor === acc.hex ? "active" : ""}`}
                        style={{ backgroundColor: acc.hex }}
                        onClick={() => setTheme((prev) => ({ ...prev, primaryColor: acc.hex }))}
                        title={acc.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="gf-kind-selector">
                  <span className="gf-theme-label">Category:</span>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as FormKind)}
                    className="gf-select-compact"
                  >
                    <option value="general">General Form</option>
                    <option value="appeal_enabled">Appeal-Enabled Form</option>
                    <option value="complaint">Complaint Form</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 2. QUESTION CARDS LIST */}
            {nodes.length === 0 ? (
              <div className="gf-empty-stream-card">
                <p>This form currently has no questions.</p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleAddNode("short_text")}
                >
                  + Add First Question
                </button>
              </div>
            ) : (
              nodes.map((node, idx) => {
                const isActive = selectedNodeId === node.id;

                return (
                  <div
                    key={node.id}
                    id={`gf-card-${node.id}`}
                    draggable
                    onDragStart={() => setDragIndex(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIndex !== null) handleMoveNode(dragIndex, idx);
                      setDragIndex(null);
                    }}
                    onClick={() => setSelectedNodeId(node.id)}
                    className={`gf-card ${isActive ? "active" : ""}`}
                    style={isActive ? { borderLeft: `6px solid ${primaryAccent}` } : undefined}
                  >
                    {/* CARD TOP REORDER HANDLE */}
                    <div
                      className="gf-card-reorder-bar"
                      title="Drag to reorder questions"
                    >
                      <span className="gf-reorder-dots">⠿⠿</span>
                    </div>

                    {/* ACTIVE STATE: INLINE FULL EDITING CONTROLS */}
                    {isActive ? (
                      <div className="gf-card-edit-body stack">
                        {/* Question Title & Field Type Row */}
                        <div className="gf-card-row-top">
                          <input
                            type="text"
                            value={node.label}
                            onChange={(e) => updateNode(node.id, { label: e.target.value })}
                            placeholder="Question label / title..."
                            className="gf-card-title-input"
                            autoFocus
                          />

                          <div className="gf-type-select-wrap">
                            <select
                              value={node.type}
                              onChange={(e) => {
                                const newType = e.target.value as FieldType;
                                const defaultOpts =
                                  newType === "dropdown" ||
                                  newType === "single_choice" ||
                                  newType === "multiple_choice"
                                    ? node.options && node.options.length > 0
                                      ? node.options
                                      : ["Option 1", "Option 2", "Option 3"]
                                    : undefined;
                                updateNode(node.id, { type: newType, options: defaultOpts });
                              }}
                              className="gf-type-select"
                            >
                              {FIELD_TYPE_OPTIONS.map((opt) => (
                                <option key={opt.type} value={opt.type}>
                                  {opt.icon} {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Optional Subtitle / Helper instructions */}
                        <input
                          type="text"
                          value={node.helpText ?? ""}
                          onChange={(e) => updateNode(node.id, { helpText: e.target.value })}
                          placeholder="Description / helper text (optional)..."
                          className="gf-card-help-input"
                        />

                        {/* Field-Specific Inline Content */}
                        {(node.type === "short_text" || node.type === "email" || node.type === "number") && (
                          <div className="gf-inline-mock-input">
                            <input
                              type="text"
                              value={node.placeholder ?? ""}
                              onChange={(e) => updateNode(node.id, { placeholder: e.target.value })}
                              placeholder={`Placeholder text (e.g. Enter ${node.label.toLowerCase()})...`}
                              className="gf-mock-input-field"
                            />
                          </div>
                        )}

                        {node.type === "long_text" && (
                          <div className="gf-inline-mock-input">
                            <textarea
                              rows={2}
                              value={node.placeholder ?? ""}
                              onChange={(e) => updateNode(node.id, { placeholder: e.target.value })}
                              placeholder="Placeholder text for paragraph response..."
                              className="gf-mock-textarea-field"
                            />
                          </div>
                        )}

                        {node.type === "date" && (
                          <div className="gf-inline-mock-input gf-date-mock">
                            <span>dd/mm/yyyy</span>
                            <span>📅</span>
                          </div>
                        )}

                        {node.type === "file_upload" && (
                          <div className="gf-file-upload-mock">
                            <span className="gf-file-icon">☁️</span>
                            <strong>Files uploaded to company Google Drive</strong>
                            <span className="gf-file-sub">Supported formats: PDF, Images, Spreadsheets, Docs up to 1 GiB.</span>
                          </div>
                        )}

                        {/* Choice & Dropdown Options Editor */}
                        {(node.type === "dropdown" ||
                          node.type === "single_choice" ||
                          node.type === "multiple_choice") && (
                          <div className="gf-options-editor stack">
                            {(node.options ?? ["Option 1"]).map((opt, optIdx) => (
                              <div key={optIdx} className="gf-option-row">
                                <span className="gf-opt-symbol">
                                  {node.type === "single_choice"
                                    ? "○"
                                    : node.type === "multiple_choice"
                                      ? "□"
                                      : `${optIdx + 1}.`}
                                </span>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => handleUpdateOption(node.id, optIdx, e.target.value)}
                                  className="gf-option-input"
                                  placeholder={`Option ${optIdx + 1}`}
                                />
                                {(node.options ?? []).length > 1 && (
                                  <button
                                    type="button"
                                    className="gf-opt-remove-btn"
                                    onClick={() => handleRemoveOption(node.id, optIdx)}
                                    title="Remove this option"
                                  >
                                    &times;
                                  </button>
                                )}
                              </div>
                            ))}

                            <div className="gf-add-option-row">
                              <span className="gf-opt-symbol">
                                {node.type === "single_choice"
                                  ? "○"
                                  : node.type === "multiple_choice"
                                    ? "□"
                                    : "+"}
                              </span>
                              <button
                                type="button"
                                className="gf-add-opt-btn"
                                onClick={() => handleAddOption(node.id)}
                              >
                                Add option
                              </button>
                            </div>
                          </div>
                        )}

                        {/* CARD ACTION FOOTER */}
                        <div className="gf-card-footer">
                          {/* Reordering Up / Down buttons */}
                          <div className="gf-footer-left">
                            <button
                              type="button"
                              className="gf-footer-btn"
                              title="Move question up"
                              disabled={idx === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveNode(idx, idx - 1);
                              }}
                            >
                              &uarr; Up
                            </button>
                            <button
                              type="button"
                              className="gf-footer-btn"
                              title="Move question down"
                              disabled={idx === nodes.length - 1}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveNode(idx, idx + 1);
                              }}
                            >
                              &darr; Down
                            </button>
                          </div>

                          {/* Duplicate, Delete, Required Switch */}
                          <div className="gf-footer-right">
                            <button
                              type="button"
                              className="gf-footer-icon-btn"
                              title="Duplicate question"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateNode(node);
                              }}
                            >
                              <span style={{ fontSize: "1rem" }}>⧉</span>
                              <span>Duplicate</span>
                            </button>
                            <button
                              type="button"
                              className="gf-footer-icon-btn danger"
                              title="Delete question"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteNode(node.id);
                              }}
                            >
                              <span style={{ fontSize: "1rem" }}>🗑️</span>
                              <span>Delete</span>
                            </button>

                            <div className="gf-footer-divider" />

                            {node.type !== "heading" &&
                              node.type !== "instructions" &&
                              node.type !== "section" && (
                                <label className="gf-required-toggle" title="Toggle required field">
                                  <span>Required</span>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(node.required)}
                                    onChange={(e) => updateNode(node.id, { required: e.target.checked })}
                                  />
                                </label>
                              )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* INACTIVE (IDLE) STATE: CLEAN QUESTION PREVIEW */
                      <div className="gf-card-idle-body">
                        <div className="gf-idle-top">
                          <div className="gf-idle-title-wrap">
                            <span className="gf-question-label">{node.label}</span>
                            {node.required && <span className="gf-req-star">*</span>}
                          </div>
                          <span className="gf-idle-type-pill">{node.type.replace("_", " ")}</span>
                        </div>

                        {node.helpText && <p className="gf-idle-help">{node.helpText}</p>}

                        <div className="gf-idle-preview-field">
                          {node.type === "heading" ? (
                            <h3 style={{ margin: "0.25rem 0", color: "var(--ink)", fontWeight: 800 }}>
                              {node.label}
                            </h3>
                          ) : node.type === "instructions" ? (
                            <div className="notice" style={{ fontSize: "0.85rem" }}>
                              {node.helpText || "Instruction notes for applicant."}
                            </div>
                          ) : node.type === "section" ? (
                            <hr className="gf-idle-divider" />
                          ) : node.type === "long_text" ? (
                            <div className="gf-idle-mock-input" style={{ minHeight: "44px" }}>
                              <span className="gf-idle-placeholder">
                                {node.placeholder || "Paragraph response..."}
                              </span>
                            </div>
                          ) : node.type === "dropdown" ? (
                            <div className="gf-idle-mock-input row-between">
                              <span className="gf-idle-placeholder">
                                {node.placeholder || "Choose an option..."}
                              </span>
                              <span>▾</span>
                            </div>
                          ) : node.type === "single_choice" ? (
                            <div className="stack" style={{ gap: "0.35rem" }}>
                              {(node.options ?? ["Option 1", "Option 2"]).map((opt, i) => (
                                <div key={i} className="gf-idle-choice-row">
                                  <span className="gf-idle-radio-dot" />
                                  <span>{opt}</span>
                                </div>
                              ))}
                            </div>
                          ) : node.type === "multiple_choice" ? (
                            <div className="stack" style={{ gap: "0.35rem" }}>
                              {(node.options ?? ["Option A", "Option B"]).map((opt, i) => (
                                <div key={i} className="gf-idle-choice-row">
                                  <span className="gf-idle-check-box" />
                                  <span>{opt}</span>
                                </div>
                              ))}
                            </div>
                          ) : node.type === "date" ? (
                            <div className="gf-idle-mock-input row-between">
                              <span className="gf-idle-placeholder">dd/mm/yyyy</span>
                              <span>📅</span>
                            </div>
                          ) : node.type === "file_upload" ? (
                            <div className="gf-idle-file-box">
                              <span>📎 Choose file (Google Drive up to 1 GiB)</span>
                            </div>
                          ) : (
                            <div className="gf-idle-mock-input">
                              <span className="gf-idle-placeholder">
                                {node.placeholder || `Short answer text...`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* 3. GOOGLE FORMS FLOATING / DOCKED ACTION RAIL */}
          <aside className="gf-action-rail" aria-label="Add Element Quick Actions">
            <div className="gf-rail-box">
              <button
                type="button"
                className="gf-rail-btn"
                onClick={() => handleAddNode("short_text")}
                title="Add Question (Short Text)"
              >
                <span className="gf-rail-icon">＋</span>
                <span className="gf-rail-tooltip">Add Question</span>
              </button>

              <button
                type="button"
                className="gf-rail-btn"
                onClick={() => handleAddNode("heading")}
                title="Add Section Heading"
              >
                <span className="gf-rail-icon">T</span>
                <span className="gf-rail-tooltip">Title / Heading</span>
              </button>

              <button
                type="button"
                className="gf-rail-btn"
                onClick={() => handleAddNode("dropdown")}
                title="Add Dropdown Select"
              >
                <span className="gf-rail-icon">▾</span>
                <span className="gf-rail-tooltip">Dropdown Select</span>
              </button>

              <button
                type="button"
                className="gf-rail-btn"
                onClick={() => handleAddNode("single_choice")}
                title="Add Multiple Choice (Radio)"
              >
                <span className="gf-rail-icon">◉</span>
                <span className="gf-rail-tooltip">Multiple Choice</span>
              </button>

              <button
                type="button"
                className="gf-rail-btn"
                onClick={() => handleAddNode("file_upload")}
                title="Add Google Drive File Upload"
              >
                <span className="gf-rail-icon">📎</span>
                <span className="gf-rail-tooltip">File Upload</span>
              </button>

              <button
                type="button"
                className="gf-rail-btn"
                onClick={() => handleAddNode("section")}
                title="Add Section Divider"
              >
                <span className="gf-rail-icon">—</span>
                <span className="gf-rail-tooltip">Section Divider</span>
              </button>
            </div>
          </aside>
        </main>
      )}

      {/* ======================================================================
          VIEW 2: LIVE PREVIEW MODE (INTERACTIVE SCROLLABLE PHONE & DESKTOP)
          ====================================================================== */}
      {activeTab === "preview" && (
        <section className="gf-preview-stage" aria-label="Live Interactive Preview">
          {/* DEVICE SWITCHER BAR */}
          <div className="gf-preview-controls">
            <div className="gf-device-switcher">
              <button
                type="button"
                className={`gf-device-btn ${previewDevice === "phone" ? "active" : ""}`}
                onClick={() => setPreviewDevice("phone")}
              >
                <span>📱 Mobile Phone (iPhone 16)</span>
              </button>
              <button
                type="button"
                className={`gf-device-btn ${previewDevice === "desktop" ? "active" : ""}`}
                onClick={() => setPreviewDevice("desktop")}
              >
                <span>🖥️ Desktop Browser (1024px)</span>
              </button>
            </div>
            <span className="notice" style={{ fontSize: "0.8rem", margin: 0 }}>
              Scrollable live preview: test how applicants see and fill this form in real-time.
            </span>
          </div>

          {/* 1. MOBILE PHONE PREVIEW CHASSIS (WITH INTERNAL SCROLLING) */}
          {previewDevice === "phone" && (
            <div className="gf-phone-chassis">
              {/* Dynamic Island Notch */}
              <div className="gf-phone-notch">
                <span className="gf-phone-lens" />
              </div>

              {/* Scrollable Phone Screen */}
              <div className="gf-phone-screen">
                <div
                  className="gf-preview-header-card"
                  style={{ borderTop: `6px solid ${primaryAccent}` }}
                >
                  <h2 className="gf-preview-title">{title || "Untitled Form"}</h2>
                  <p className="gf-preview-desc">{description}</p>
                  <div className="gf-preview-meta">
                    <span className="badge badge-configured">Forms MESRC Official</span>
                    <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>* Required</span>
                  </div>
                </div>

                <div className="gf-preview-questions-list stack">
                  {nodes.map((node) => (
                    <div key={node.id} className="gf-preview-q-card">
                      <div className="gf-preview-q-label">
                        <span>{node.label}</span>
                        {node.required && <span className="gf-req-star">*</span>}
                      </div>
                      {node.helpText && (
                        <p className="gf-preview-q-help">{node.helpText}</p>
                      )}

                      <div className="gf-preview-q-input-wrap">
                        {node.type === "heading" ? (
                          <h4 style={{ margin: 0, fontWeight: 800 }}>{node.label}</h4>
                        ) : node.type === "instructions" ? (
                          <p className="notice" style={{ fontSize: "0.82rem", margin: 0 }}>
                            {node.helpText || "Helper information."}
                          </p>
                        ) : node.type === "section" ? (
                          <hr style={{ border: "none", borderTop: "1px dashed var(--border-strong)", margin: "0.5rem 0" }} />
                        ) : node.type === "long_text" ? (
                          <textarea
                            rows={3}
                            placeholder={node.placeholder || "Enter your response..."}
                            className="input"
                            style={{ width: "100%" }}
                          />
                        ) : node.type === "dropdown" ? (
                          <select className="input" style={{ width: "100%" }} defaultValue="">
                            <option value="" disabled>
                              {node.placeholder || "Choose option..."}
                            </option>
                            {(node.options ?? ["Option 1", "Option 2"]).map((opt, i) => (
                              <option key={i} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : node.type === "single_choice" ? (
                          <div className="stack" style={{ gap: "0.45rem" }}>
                            {(node.options ?? ["Option 1", "Option 2"]).map((opt, i) => (
                              <label key={i} className="gf-preview-choice-label">
                                <input type="radio" name={`radio-${node.id}`} />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        ) : node.type === "multiple_choice" ? (
                          <div className="stack" style={{ gap: "0.45rem" }}>
                            {(node.options ?? ["Option A", "Option B"]).map((opt, i) => (
                              <label key={i} className="gf-preview-choice-label">
                                <input type="checkbox" />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        ) : node.type === "date" ? (
                          <input type="date" className="input" style={{ width: "100%" }} />
                        ) : node.type === "file_upload" ? (
                          <div className="gf-preview-file-dropzone">
                            <span style={{ fontSize: "1.2rem" }}>📎</span>
                            <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Tap to add attachment</span>
                            <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Google Drive safe storage</span>
                          </div>
                        ) : (
                          <input
                            type={node.type === "email" ? "email" : node.type === "number" ? "number" : "text"}
                            placeholder={node.placeholder || `Enter ${node.label.toLowerCase()}...`}
                            className="input"
                            style={{ width: "100%" }}
                          />
                        )}
                      </div>
                    </div>
                  ))}

                  {/* SUBMIT BUTTON MOCK */}
                  <div className="gf-preview-submit-wrap">
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ width: "100%", padding: "0.75rem", backgroundColor: primaryAccent }}
                    >
                      Submit Form &rarr;
                    </button>
                    {allowSaveDraft && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ width: "100%", padding: "0.6rem", fontSize: "0.82rem" }}
                      >
                        Save Draft
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Home Indicator */}
              <div className="gf-phone-home-bar" />
            </div>
          )}

          {/* 2. DESKTOP BROWSER PREVIEW CHASSIS (WITH INTERNAL SCROLLING) */}
          {previewDevice === "desktop" && (
            <div className="gf-desktop-chassis">
              {/* Browser Window Header */}
              <div className="gf-desktop-browser-bar">
                <div className="gf-browser-dots">
                  <span className="dot red" />
                  <span className="dot yellow" />
                  <span className="dot green" />
                </div>
                <div className="gf-browser-url-pill">
                  <span>🔒 forms.mesrc.com.my/forms/{slug || "new-form"}</span>
                </div>
                <div style={{ width: 44 }} />
              </div>

              {/* Scrollable Desktop Body */}
              <div className="gf-desktop-screen">
                <div
                  className="gf-preview-header-card"
                  style={{ borderTop: `8px solid ${primaryAccent}` }}
                >
                  <h1 className="gf-preview-title" style={{ fontSize: "1.75rem" }}>
                    {title || "Untitled Form"}
                  </h1>
                  <p className="gf-preview-desc">{description}</p>
                  <div className="gf-preview-meta">
                    <span className="badge badge-configured">Forms MESRC Official</span>
                    <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>* Indicates required question</span>
                  </div>
                </div>

                <div className="gf-preview-questions-list stack">
                  {nodes.map((node) => (
                    <div key={node.id} className="gf-preview-q-card">
                      <div className="gf-preview-q-label">
                        <span>{node.label}</span>
                        {node.required && <span className="gf-req-star">*</span>}
                      </div>
                      {node.helpText && (
                        <p className="gf-preview-q-help">{node.helpText}</p>
                      )}

                      <div className="gf-preview-q-input-wrap">
                        {node.type === "heading" ? (
                          <h3 style={{ margin: 0, fontWeight: 800 }}>{node.label}</h3>
                        ) : node.type === "instructions" ? (
                          <p className="notice" style={{ fontSize: "0.88rem", margin: 0 }}>
                            {node.helpText || "Helper information."}
                          </p>
                        ) : node.type === "section" ? (
                          <hr style={{ border: "none", borderTop: "1px dashed var(--border-strong)", margin: "0.75rem 0" }} />
                        ) : node.type === "long_text" ? (
                          <textarea
                            rows={4}
                            placeholder={node.placeholder || "Enter your response..."}
                            className="input"
                            style={{ width: "100%", maxWidth: "600px" }}
                          />
                        ) : node.type === "dropdown" ? (
                          <select className="input" style={{ width: "100%", maxWidth: "400px" }} defaultValue="">
                            <option value="" disabled>
                              {node.placeholder || "Choose option..."}
                            </option>
                            {(node.options ?? ["Option 1", "Option 2"]).map((opt, i) => (
                              <option key={i} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : node.type === "single_choice" ? (
                          <div className="stack" style={{ gap: "0.55rem" }}>
                            {(node.options ?? ["Option 1", "Option 2"]).map((opt, i) => (
                              <label key={i} className="gf-preview-choice-label">
                                <input type="radio" name={`radio-${node.id}`} />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        ) : node.type === "multiple_choice" ? (
                          <div className="stack" style={{ gap: "0.55rem" }}>
                            {(node.options ?? ["Option A", "Option B"]).map((opt, i) => (
                              <label key={i} className="gf-preview-choice-label">
                                <input type="checkbox" />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        ) : node.type === "date" ? (
                          <input type="date" className="input" style={{ width: "100%", maxWidth: "260px" }} />
                        ) : node.type === "file_upload" ? (
                          <div className="gf-preview-file-dropzone" style={{ maxWidth: "500px" }}>
                            <span style={{ fontSize: "1.4rem" }}>📎</span>
                            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Choose file or drag here</span>
                            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Google Drive storage up to 1 GiB</span>
                          </div>
                        ) : (
                          <input
                            type={node.type === "email" ? "email" : node.type === "number" ? "number" : "text"}
                            placeholder={node.placeholder || `Enter ${node.label.toLowerCase()}...`}
                            className="input"
                            style={{ width: "100%", maxWidth: "460px" }}
                          />
                        )}
                      </div>
                    </div>
                  ))}

                  {/* DESKTOP SUBMIT ACTIONS */}
                  <div className="row-actions" style={{ marginTop: "1rem", gap: "0.75rem" }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: "0.75rem 1.75rem", backgroundColor: primaryAccent }}
                    >
                      Submit Form &rarr;
                    </button>
                    {allowSaveDraft && (
                      <button type="button" className="btn btn-secondary">
                        Save Draft
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ======================================================================
          VIEW 3: FORMS CATALOG & TEMPLATES
          ====================================================================== */}
      {activeTab === "catalog" && (
        <main className="gf-catalog-stage">
          <section className="card stack" style={{ maxWidth: "1024px", margin: "2rem auto" }}>
            <div className="row-between">
              <div>
                <h2>Forms Catalog ({forms.length})</h2>
                <p className="notice">
                  Browse and edit saved forms, or start a new form from an official company template.
                </p>
              </div>
              <div className="row-actions">
                {FORM_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.key}
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleLoadTemplate(tpl.key)}
                  >
                    + Template: {tpl.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Slug</th>
                    <th>Kind</th>
                    <th>State</th>
                    <th>Version</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {forms.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="notice" style={{ textAlign: "center", padding: "2rem" }}>
                        No forms found. Create your first form in the Questions tab or load a template above.
                      </td>
                    </tr>
                  ) : (
                    forms.map((f) => (
                      <tr key={f.id}>
                        <td>
                          <strong style={{ color: "var(--ink)" }}>{f.title}</strong>
                        </td>
                        <td>
                          <code>{f.slug}</code>
                        </td>
                        <td>{f.kind}</td>
                        <td>
                          <span
                            className={`badge ${
                              f.state === "published"
                                ? "badge-configured"
                                : "badge-not_configured"
                            }`}
                          >
                            {f.state}
                          </span>
                        </td>
                        <td>
                          Latest: v{f.latest_version} | Live:{" "}
                          {f.current_published_version ? `v${f.current_published_version}` : "—"}
                        </td>
                        <td className="row-actions">
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ padding: "0.26rem 0.65rem", fontSize: "0.78rem" }}
                            onClick={() => handleSelectExistingForm(f)}
                          >
                            Open in Studio &rarr;
                          </button>
                          {f.state !== "archived" && (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: "0.26rem 0.65rem", fontSize: "0.78rem", color: "var(--err-text)" }}
                              onClick={() => handleArchive(f.id)}
                            >
                              Archive
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}

      {/* ======================================================================
          VIEW 4: SETTINGS & ACCESS ALLOWLIST
          ====================================================================== */}
      {activeTab === "settings" && (
        <main className="gf-settings-stage">
          <section className="card stack" style={{ maxWidth: "860px", margin: "2rem auto" }}>
            <div className="row-between">
              <div>
                <h2>Form Configuration &amp; Access Policies</h2>
                <p className="notice">
                  Configure form slug, security policies, associated departments, and email access control.
                </p>
              </div>
            </div>

            <div className="grid-2">
              <div className="field">
                <label htmlFor="fb-title">Form Title</label>
                <input
                  id="fb-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="fb-slug">URL Slug</label>
                <input
                  id="fb-slug"
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="fb-desc">Form Description</label>
              <textarea
                id="fb-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid-2">
              <div className="field">
                <label htmlFor="fb-kind">Workflow Category</label>
                <select
                  id="fb-kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as FormKind)}
                >
                  <option value="general">General Form</option>
                  <option value="appeal_enabled">Appeal-Enabled Form</option>
                  <option value="complaint">Complaint Form</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="fb-accent">Theme Primary Color</label>
                <select
                  id="fb-accent"
                  value={theme.primaryColor ?? "#1d4ed8"}
                  onChange={(e) => setTheme({ ...theme, primaryColor: e.target.value })}
                >
                  {THEME_ACCENTS.map((acc) => (
                    <option key={acc.hex} value={acc.hex}>
                      {acc.name} ({acc.hex})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid-2">
              <div className="field">
                <label>Associated Services (Operations)</label>
                <div className="row-actions" style={{ marginTop: "0.35rem" }}>
                  {services.length === 0 ? (
                    <span className="notice" style={{ fontSize: "0.85rem" }}>
                      No company services defined yet.
                    </span>
                  ) : (
                    services.map((svc) => {
                      const checked = selectedServices.includes(svc.id);
                      return (
                        <label
                          key={svc.id}
                          style={{
                            fontWeight: 500,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            fontSize: "0.86rem",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setSelectedServices((prev) =>
                                e.target.checked
                                  ? [...prev, svc.id]
                                  : prev.filter((x) => x !== svc.id),
                              )
                            }
                          />
                          {svc.name}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="field">
                <label htmlFor="fb-allowlist">
                  Email Allowlist (Leave empty for all active members)
                </label>
                <textarea
                  id="fb-allowlist"
                  rows={3}
                  placeholder="Optional: one email per line. If populated, only listed emails can view and submit."
                  value={allowlistText}
                  onChange={(e) => setAllowlistText(e.target.value)}
                />
              </div>
            </div>

            <div className="profile-dropdown-divider" />

            <div className="stack" style={{ gap: "0.65rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.86rem" }}>
                <input
                  type="checkbox"
                  checked={allowSaveDraft}
                  onChange={(e) => setAllowSaveDraft(e.target.checked)}
                />
                Allow applicants to save in-progress drafts
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.86rem" }}>
                <input
                  type="checkbox"
                  checked={allowAppeal}
                  onChange={(e) => setAllowAppeal(e.target.checked)}
                />
                Enable formal rejection appeal review
              </label>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
