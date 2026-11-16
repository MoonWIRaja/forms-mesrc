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

interface PaletteItem {
  type: FieldType;
  label: string;
  category: "structure" | "inputs" | "choice" | "media";
  desc: string;
}

const PALETTE_ITEMS: PaletteItem[] = [
  // Structure
  { type: "heading", label: "Heading", category: "structure", desc: "Section title" },
  { type: "instructions", label: "Instructions", category: "structure", desc: "Helper paragraph" },
  { type: "section", label: "Section Divider", category: "structure", desc: "Break line" },

  // Inputs
  { type: "short_text", label: "Short Text", category: "inputs", desc: "Single line text" },
  { type: "long_text", label: "Long Text", category: "inputs", desc: "Multi-line paragraph" },
  { type: "email", label: "Email Address", category: "inputs", desc: "Valid email input" },
  { type: "number", label: "Numeric Value", category: "inputs", desc: "Numbers & amounts" },
  { type: "date", label: "Date Picker", category: "inputs", desc: "Calendar date" },

  // Choice
  { type: "dropdown", label: "Dropdown Select", category: "choice", desc: "Pick from list" },
  { type: "single_choice", label: "Single Choice (Radio)", category: "choice", desc: "One of many" },
  { type: "multiple_choice", label: "Multi Choice (Checkbox)", category: "choice", desc: "Check all that apply" },

  // Media
  { type: "file_upload", label: "File Upload", category: "media", desc: "Google Drive (up to 1 GiB)" },
];

export default function AdminFormBuilderPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [forms, setForms] = useState<FormRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
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
  const [mobileNodes, setMobileNodes] = useState<FormFieldNode[]>(FORM_TEMPLATES[0].nodes);
  const [syncViews, setSyncViews] = useState(true);
  const [canvasView, setCanvasView] = useState<"dual" | "desktop" | "mobile">("dual");
  const [theme, setTheme] = useState<FormTheme>({
    primaryColor: "#1d4ed8",
    cardRadius: "rounded",
    density: "comfortable",
  });

  // UI Studio State
  const [activeTab, setActiveTab] = useState<"studio" | "catalog" | "settings">("studio");
  const [sidebarTab, setSidebarTab] = useState<"elements" | "properties">("elements");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const seqRef = useRef(1);

  // Full-bleed studio breakout: remove standard shell constraints
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
        setMobileNodes(parsedNodes);
        setTheme(((ver as { theme_json: FormTheme }).theme_json ?? {}) as FormTheme);
      }
      setSelectedNodeId(null);
      setActiveTab("studio");
      setInfo(`Loaded form "${f.title}" in Studio.`);
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
    setMobileNodes(cloned);
    setSelectedNodeId(null);
    setActiveTab("studio");
    setInfo(`Loaded template: ${tpl.name}`);
  }

  function updateNode(nodeId: string, patch: Partial<FormFieldNode>) {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)));
    if (syncViews) {
      setMobileNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)));
    } else {
      setMobileNodes((prev) =>
        prev.some((n) => n.id === nodeId)
          ? prev.map((n) => (n.id === nodeId ? { ...n, ...patch } : n))
          : prev,
      );
    }
  }

  function handleAddNode(type: FieldType) {
    seqRef.current += 1;
    const id = `fld_${nodes.length + seqRef.current}`;
    const defaultOptions =
      type === "dropdown" || type === "single_choice" || type === "multiple_choice"
        ? ["Option 1", "Option 2", "Option 3"]
        : undefined;
    const newNode: FormFieldNode = {
      id,
      type,
      label: `New ${type.replace("_", " ")}`,
      required: false,
      options: defaultOptions,
      width: "full",
    };
    setNodes((prev) => [...prev, newNode]);
    if (syncViews) {
      setMobileNodes((prev) => [...prev, newNode]);
    }
    setSelectedNodeId(id);
    setSidebarTab("properties");
  }

  function handleDuplicateNode(nodeToCopy: FormFieldNode, isMobile = false) {
    seqRef.current += 1;
    const newId = `fld_${nodes.length + seqRef.current}`;
    const cloned: FormFieldNode = {
      ...nodeToCopy,
      id: newId,
      label: `${nodeToCopy.label} (Copy)`,
    };
    if (isMobile && !syncViews) {
      const idx = mobileNodes.findIndex((n) => n.id === nodeToCopy.id);
      const updated = [...mobileNodes];
      updated.splice(idx + 1, 0, cloned);
      setMobileNodes(updated);
    } else {
      const idx = nodes.findIndex((n) => n.id === nodeToCopy.id);
      const updated = [...nodes];
      updated.splice(idx + 1, 0, cloned);
      setNodes(updated);
      if (syncViews) {
        setMobileNodes([...updated]);
      }
    }
    setSelectedNodeId(newId);
    setSidebarTab("properties");
  }

  function handleMoveNode(fromIdx: number, toIdx: number, isMobile = false) {
    if (isMobile && !syncViews) {
      if (toIdx < 0 || toIdx >= mobileNodes.length || fromIdx === toIdx) return;
      const copy = [...mobileNodes];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      setMobileNodes(copy);
      return;
    }
    if (toIdx < 0 || toIdx >= nodes.length || fromIdx === toIdx) return;
    const copy = [...nodes];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    setNodes(copy);
    if (syncViews) {
      setMobileNodes([...copy]);
    }
  }

  function handleDeleteNode(id: string, isMobile = false) {
    if (isMobile && !syncViews) {
      setMobileNodes((prev) => prev.filter((n) => n.id !== id));
      if (selectedNodeId === id) setSelectedNodeId(null);
      return;
    }
    setNodes((prev) => prev.filter((n) => n.id !== id));
    if (syncViews) {
      setMobileNodes((prev) => prev.filter((n) => n.id !== id));
    }
    if (selectedNodeId === id) setSelectedNodeId(null);
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
    return <ChunkLoader title="Form Studio" subtitle="Loading visual builder..." />;
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

  const selectedNode =
    nodes.find((n) => n.id === selectedNodeId) ??
    mobileNodes.find((n) => n.id === selectedNodeId) ??
    null;
  const currentFormRecord = forms.find((f) => f.id === selectedFormId);

  function renderNodeCard(
    node: FormFieldNode,
    idx: number,
    nodeList: FormFieldNode[],
    isMobile: boolean,
  ) {
    const isSelected = selectedNodeId === node.id;
    return (
      <div
        key={node.id}
        draggable
        onDragStart={() => setDragIndex(idx)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => {
          if (dragIndex !== null) handleMoveNode(dragIndex, idx, isMobile);
          setDragIndex(null);
        }}
        onClick={() => {
          setSelectedNodeId(node.id);
          setSidebarTab("properties");
        }}
        className={`canvas-node-card ${isSelected ? "selected" : ""}`}
      >
        {isSelected && (
          <span className="node-selection-badge">Selected Field</span>
        )}

        <div className="canvas-node-top">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              className="canvas-node-drag-handle"
              title="Drag up or down to reorder"
            >
              ⠿
            </span>
            <strong style={{ fontSize: "0.88rem", color: "var(--ink)" }}>
              {node.label}
            </strong>
            {node.required && (
              <span style={{ color: "var(--err-text)", fontWeight: 700 }} title="Required field">*</span>
            )}
          </div>

          <div className="canvas-node-actions">
            <button
              type="button"
              className="node-tool-btn"
              title="Move up"
              onClick={(e) => {
                e.stopPropagation();
                handleMoveNode(idx, idx - 1, isMobile);
              }}
              disabled={idx === 0}
            >
              &uarr;
            </button>
            <button
              type="button"
              className="node-tool-btn"
              title="Move down"
              onClick={(e) => {
                e.stopPropagation();
                handleMoveNode(idx, idx + 1, isMobile);
              }}
              disabled={idx === nodeList.length - 1}
            >
              &darr;
            </button>
            <button
              type="button"
              className="node-tool-btn"
              title="Duplicate field"
              onClick={(e) => {
                e.stopPropagation();
                handleDuplicateNode(node, isMobile);
              }}
            >
              ⧉
            </button>
            <button
              type="button"
              className="node-tool-btn danger"
              title="Delete field"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteNode(node.id, isMobile);
              }}
            >
              &times;
            </button>
          </div>
        </div>

        <div className="canvas-node-preview">
          {node.type === "heading" ? (
            <h3 style={{ margin: "0.2rem 0", color: "var(--ink)", fontWeight: 800 }}>{node.label}</h3>
          ) : node.type === "instructions" ? (
            <p className="notice" style={{ fontSize: "0.82rem", margin: "0.2rem 0" }}>
              {node.helpText || "Instruction text for the applicant..."}
            </p>
          ) : node.type === "section" ? (
            <div style={{ borderTop: "2px dashed var(--border-strong)", margin: "0.5rem 0" }} />
          ) : node.type === "long_text" ? (
            <div className="phone-mock-input" style={{ minHeight: "56px", alignItems: "flex-start" }}>
              <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                {node.placeholder || "Enter detailed response..."}
              </span>
            </div>
          ) : node.type === "dropdown" ? (
            <div className="phone-mock-input phone-mock-select">
              <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                {node.placeholder || "Select an option..."}
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>▼</span>
            </div>
          ) : node.type === "single_choice" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginTop: "0.3rem" }}>
              {(node.options ?? ["Option 1", "Option 2"]).map((opt, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem", color: "var(--ink-secondary)" }}>
                  <span style={{ width: "14px", height: "14px", borderRadius: "50%", border: "1.5px solid var(--border-strong)", display: "inline-block" }} />
                  <span>{opt}</span>
                </div>
              ))}
            </div>
          ) : node.type === "multiple_choice" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginTop: "0.3rem" }}>
              {(node.options ?? ["Option A", "Option B"]).map((opt, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem", color: "var(--ink-secondary)" }}>
                  <span style={{ width: "14px", height: "14px", borderRadius: "3px", border: "1.5px solid var(--border-strong)", display: "inline-block" }} />
                  <span>{opt}</span>
                </div>
              ))}
            </div>
          ) : node.type === "date" ? (
            <div className="phone-mock-input phone-mock-select">
              <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>dd/mm/yyyy</span>
              <span style={{ fontSize: "0.85rem" }}>📅</span>
            </div>
          ) : node.type === "file_upload" ? (
            <div className="phone-mock-file">
              <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>Choose file or drag here</span>
              <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Google Drive upload up to 1 GiB</span>
            </div>
          ) : (
            <div className="phone-mock-input">
              <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                {node.placeholder || `Enter ${node.label.toLowerCase()}...`}
              </span>
            </div>
          )}

          {node.helpText && node.type !== "instructions" && (
            <div style={{ fontSize: "0.74rem", color: "var(--muted)", marginTop: "0.35rem" }}>
              {node.helpText}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="studio-shell studio-mode">
      <div className="studio-wrapper">
        {/* ==================================================================
            TOP COMMAND TOOLBAR (FIGMA / N8N / CANVA HEADER)
            ================================================================== */}
        <header className="studio-toolbar" aria-label="Studio Command Bar">
          <div className="studio-toolbar-left">
            <Link href="/admin/" className="btn btn-secondary studio-exit-btn" title="Exit to Submissions dashboard">
              &larr; Exit
            </Link>
            <div className="studio-brand-badge" title="Forms MESRC Canvas Studio">
              <BrandLogo size="sm" />
              <span>Studio</span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="studio-title-input"
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

          <div className="studio-toolbar-center">
            <div className="studio-tab-group" role="tablist">
              <button
                type="button"
                className={`studio-tab-btn ${activeTab === "studio" ? "active" : ""}`}
                onClick={() => setActiveTab("studio")}
              >
                Canvas Studio
              </button>
              <button
                type="button"
                className={`studio-tab-btn ${activeTab === "catalog" ? "active" : ""}`}
                onClick={() => setActiveTab("catalog")}
              >
                Forms Catalog ({forms.length})
              </button>
              <button
                type="button"
                className={`studio-tab-btn ${activeTab === "settings" ? "active" : ""}`}
                onClick={() => setActiveTab("settings")}
              >
                Settings &amp; Access
              </button>
            </div>
          </div>

          <div className="studio-toolbar-right">
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
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}
        {info && (
          <p className="alert alert-ok" role="status">
            {info}
          </p>
        )}

        {/* ==================================================================
            VIEW 1: CANVAS STUDIO (3-COLUMN FIGMA / CANVA / N8N WORKSPACE)
            ================================================================== */}
        {activeTab === "studio" && (
          <div className="studio-grid">
            {/* COLUMN 1: LEFT UNIFIED FIGMA STUDIO SIDEBAR (ELEMENTS & PROPERTIES TABS) */}
            <aside className="studio-sidebar" aria-label="Studio Elements and Properties">
              <div className="studio-sidebar-nav">
                <button
                  type="button"
                  className={`studio-sidebar-tab-btn ${sidebarTab === "elements" ? "active" : ""}`}
                  onClick={() => setSidebarTab("elements")}
                >
                  <span>🧩 Elements</span>
                </button>
                <button
                  type="button"
                  className={`studio-sidebar-tab-btn ${sidebarTab === "properties" ? "active" : ""}`}
                  onClick={() => setSidebarTab("properties")}
                >
                  <span>⚙️ Properties</span>
                </button>
              </div>

              {sidebarTab === "elements" && (
                <div className="studio-palette">
                  <div>
                    <span className="palette-section-title">Form Elements</span>
                    <p className="notice" style={{ fontSize: "0.78rem", marginBottom: "0.75rem" }}>
                      Click to add directly onto the canvas.
                    </p>
                  </div>

                  <div>
                    <div className="palette-section-title">Structure</div>
                    <div className="palette-items-list">
                      {PALETTE_ITEMS.filter((i) => i.category === "structure").map((item) => (
                        <button
                          key={item.type}
                          type="button"
                          className="palette-item-card"
                          onClick={() => handleAddNode(item.type)}
                          title={`Add ${item.label} (${item.desc})`}
                        >
                          <span>{item.label}</span>
                          <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>+ Add</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="palette-section-title">Text &amp; Inputs</div>
                    <div className="palette-items-list">
                      {PALETTE_ITEMS.filter((i) => i.category === "inputs").map((item) => (
                        <button
                          key={item.type}
                          type="button"
                          className="palette-item-card"
                          onClick={() => handleAddNode(item.type)}
                          title={`Add ${item.label} (${item.desc})`}
                        >
                          <span>{item.label}</span>
                          <span style={{ fontSize: "0.75rem", color: "var(--accent)" }}>+ Add</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="palette-section-title">Choices &amp; Dropdowns</div>
                    <div className="palette-items-list">
                      {PALETTE_ITEMS.filter((i) => i.category === "choice").map((item) => (
                        <button
                          key={item.type}
                          type="button"
                          className="palette-item-card"
                          onClick={() => handleAddNode(item.type)}
                          title={`Add ${item.label} (${item.desc})`}
                        >
                          <span>{item.label}</span>
                          <span style={{ fontSize: "0.75rem", color: "var(--amber)" }}>+ Add</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="palette-section-title">Attachments</div>
                    <div className="palette-items-list">
                      {PALETTE_ITEMS.filter((i) => i.category === "media").map((item) => (
                        <button
                          key={item.type}
                          type="button"
                          className="palette-item-card"
                          onClick={() => handleAddNode(item.type)}
                          title={`Add ${item.label} (${item.desc})`}
                        >
                          <span>{item.label}</span>
                          <span style={{ fontSize: "0.75rem", color: "var(--ok-text)" }}>+ Add</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {sidebarTab === "properties" && (
                <div className="studio-inspector">
                  <div className="inspector-header">
                    <span className="inspector-title">
                      {selectedNode ? "Field Properties" : "Form Overview"}
                    </span>
                    {selectedNode ? (
                      <button
                        type="button"
                        className="btn-link"
                        style={{ fontSize: "0.78rem" }}
                        onClick={() => setSelectedNodeId(null)}
                      >
                        Deselect
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                        onClick={() => setSidebarTab("elements")}
                      >
                        + Add Elements
                      </button>
                    )}
                  </div>

                  {selectedNode ? (
                    // Field Inspector
                    <div className="stack" style={{ gap: "0.85rem" }}>
                      <div className="field">
                        <label htmlFor="prop-type">Field Type</label>
                        <input
                          id="prop-type"
                          type="text"
                          value={selectedNode.type}
                          disabled
                          style={{ background: "var(--surface-muted)", cursor: "not-allowed" }}
                        />
                      </div>

                      <div className="field">
                        <label htmlFor="prop-label">Label / Prompt Text</label>
                        <input
                          id="prop-label"
                          type="text"
                          value={selectedNode.label}
                          onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
                        />
                      </div>

                      {selectedNode.type !== "heading" &&
                        selectedNode.type !== "instructions" &&
                        selectedNode.type !== "section" && (
                          <>
                            <div className="field">
                              <label htmlFor="prop-ph">Placeholder Text</label>
                              <input
                                id="prop-ph"
                                type="text"
                                placeholder="e.g. Enter your department name..."
                                value={selectedNode.placeholder ?? ""}
                                onChange={(e) => updateNode(selectedNode.id, { placeholder: e.target.value })}
                              />
                            </div>

                            <div className="field">
                              <label htmlFor="prop-help">Help / Subtitle Text</label>
                              <input
                                id="prop-help"
                                type="text"
                                placeholder="Optional instructions below input..."
                                value={selectedNode.helpText ?? ""}
                                onChange={(e) => updateNode(selectedNode.id, { helpText: e.target.value })}
                              />
                            </div>

                            <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontWeight: 600, fontSize: "0.86rem" }}>
                              <input
                                type="checkbox"
                                checked={Boolean(selectedNode.required)}
                                onChange={(e) => updateNode(selectedNode.id, { required: e.target.checked })}
                              />
                              Mandatory / Required Field
                            </label>
                          </>
                        )}

                      {(selectedNode.type === "dropdown" ||
                        selectedNode.type === "single_choice" ||
                        selectedNode.type === "multiple_choice") && (
                        <div className="field">
                          <label htmlFor="prop-opts">Options (One choice per line)</label>
                          <textarea
                            id="prop-opts"
                            rows={4}
                            value={(selectedNode.options ?? []).join("\n")}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                options: e.target.value
                                  .split("\n")
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              })
                            }
                          />
                        </div>
                      )}

                      <div className="profile-dropdown-divider" />

                      <div className="row-actions" style={{ justifyContent: "space-between" }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
                          onClick={() => handleDuplicateNode(selectedNode)}
                        >
                          Duplicate Field
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", color: "var(--err-text)" }}
                          onClick={() => handleDeleteNode(selectedNode.id)}
                        >
                          Delete Field
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Form Overview Inspector (when no single node is selected)
                    <div className="stack" style={{ gap: "0.85rem" }}>
                      <p className="notice" style={{ fontSize: "0.82rem" }}>
                        Click any field on the canvas to inspect its validation and choices.
                      </p>

                      <div className="field">
                        <label htmlFor="ins-slug">URL Slug</label>
                        <input
                          id="ins-slug"
                          type="text"
                          value={slug}
                          onChange={(e) => setSlug(e.target.value)}
                        />
                      </div>

                      <div className="field">
                        <label htmlFor="ins-kind">Workflow Category</label>
                        <select
                          id="ins-kind"
                          value={kind}
                          onChange={(e) => setKind(e.target.value as FormKind)}
                        >
                          <option value="general">General Form</option>
                          <option value="appeal_enabled">Appeal-Enabled Form</option>
                          <option value="complaint">Complaint Form</option>
                        </select>
                      </div>

                      <div className="field">
                        <label htmlFor="ins-color">Theme Accent</label>
                        <select
                          id="ins-color"
                          value={theme.primaryColor ?? "#1d4ed8"}
                          onChange={(e) => setTheme({ ...theme, primaryColor: e.target.value })}
                        >
                          <option value="#1d4ed8">Royal Blue (#1d4ed8)</option>
                          <option value="#0f766e">Teal (#0f766e)</option>
                          <option value="#7c3aed">Violet (#7c3aed)</option>
                          <option value="#b45309">Amber (#b45309)</option>
                          <option value="#be123c">Crimson (#be123c)</option>
                          <option value="#18181b">Obsidian (#18181b)</option>
                        </select>
                      </div>

                      <div className="profile-dropdown-divider" />

                      <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.84rem" }}>
                        <input
                          type="checkbox"
                          checked={allowSaveDraft}
                          onChange={(e) => setAllowSaveDraft(e.target.checked)}
                        />
                        Allow Users to save draft
                      </label>

                      <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.84rem" }}>
                        <input
                          type="checkbox"
                          checked={allowAppeal}
                          onChange={(e) => setAllowAppeal(e.target.checked)}
                        />
                        Enable formal appeal review
                      </label>
                    </div>
                  )}
                </div>
              )}
            </aside>

            {/* COLUMN 2: CENTER FIGMA CANVAS STAGE (DUAL DESKTOP + MOBILE ARTBOARDS) */}
            <main className="studio-canvas-stage" aria-label="Visual Form Studio Canvas">
              {/* TOP VIEWPORT COMMAND BAR */}
              <div className="canvas-viewport-bar">
                <div className="canvas-view-switcher">
                  <button
                    type="button"
                    className={`viewport-pill ${canvasView === "dual" ? "active" : ""}`}
                    onClick={() => setCanvasView("dual")}
                    title="View Desktop and Mobile artboards side-by-side (Figma style)"
                  >
                    <span>⚡ Dual View (Figma)</span>
                  </button>
                  <button
                    type="button"
                    className={`viewport-pill ${canvasView === "desktop" ? "active" : ""}`}
                    onClick={() => setCanvasView("desktop")}
                    title="Desktop Frame Only"
                  >
                    <span>🖥️ Desktop</span>
                  </button>
                  <button
                    type="button"
                    className={`viewport-pill ${canvasView === "mobile" ? "active" : ""}`}
                    onClick={() => setCanvasView("mobile")}
                    title="Mobile Phone Chassis Only"
                  >
                    <span>📱 Mobile</span>
                  </button>
                </div>

                <div className="canvas-sync-toggle">
                  <label className="sync-checkbox-label" title="When checked, content added or modified in Desktop automatically syncs to Mobile in real-time">
                    <input
                      type="checkbox"
                      checked={syncViews}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSyncViews(checked);
                        if (checked) {
                          setMobileNodes([...nodes]);
                          setInfo("Views synchronized: Content in Desktop is mirrored to Mobile.");
                        } else {
                          setInfo("Views unlinked: You can now adjust Desktop and Mobile layouts independently.");
                        }
                      }}
                    />
                    <span className="sync-text">Sync Desktop &amp; Mobile</span>
                    <span className={`sync-status-badge ${syncViews ? "synced" : "unlinked"}`}>
                      {syncViews ? "✓ Live Synced" : "Unlinked"}
                    </span>
                  </label>
                </div>
              </div>

              {/* ARTBOARDS CONTAINER */}
              <div className={`canvas-artboards-container ${canvasView}`}>
                {/* 1. DESKTOP ARTBOARD */}
                {(canvasView === "dual" || canvasView === "desktop") && (
                  <div className="figma-artboard-frame desktop-artboard">
                    <div className="figma-frame-header">
                      <div className="figma-frame-title">
                        <span>🖥️</span>
                        <strong>Desktop Frame</strong>
                        <span className="figma-frame-meta">1024 × Auto</span>
                      </div>
                      <span className="figma-badge">Desktop Preview</span>
                    </div>

                    <div className="desktop-device-chassis">
                      {/* Browser Mock Window Bar */}
                      <div className="desktop-browser-bar">
                        <div className="desktop-browser-dots">
                          <span className="dot red" />
                          <span className="dot yellow" />
                          <span className="dot green" />
                        </div>
                        <div className="desktop-url-bar">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                          <span>forms.mesrc.com.my/forms/{slug || "new-form"}</span>
                        </div>
                        <div style={{ width: 44 }} />
                      </div>

                      {/* Desktop Canvas Content */}
                      <div className="desktop-canvas-content">
                        <div className="artboard-header">
                          <h2 className="artboard-title">{title || "Untitled Form"}</h2>
                          <p className="artboard-desc">{description || "Please fill out this form."}</p>
                        </div>

                        {nodes.length === 0 ? (
                          <div className="canvas-empty-state">
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                              <line x1="12" y1="8" x2="12" y2="16" />
                              <line x1="8" y1="12" x2="16" y2="12" />
                            </svg>
                            <strong style={{ fontSize: "0.95rem" }}>Desktop Form is Empty</strong>
                            <span style={{ fontSize: "0.8rem" }}>Click any element from the left palette to add fields to this form.</span>
                          </div>
                        ) : (
                          nodes.map((node, idx) => renderNodeCard(node, idx, nodes, false))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. MOBILE PHONE ARTBOARD */}
                {(canvasView === "dual" || canvasView === "mobile") && (
                  <div className="figma-artboard-frame mobile-artboard">
                    <div className="figma-frame-header">
                      <div className="figma-frame-title">
                        <span>📱</span>
                        <strong>Mobile Frame</strong>
                        <span className="figma-frame-meta">390 × 844 · iPhone 16</span>
                      </div>
                      <span className="figma-badge">Mobile Preview</span>
                    </div>

                    <div className="phone-device-chassis">
                      {/* Top Dynamic Island Notch */}
                      <div className="phone-island-notch" aria-hidden="true">
                        <span className="phone-camera-lens" />
                      </div>

                      {/* Phone Screen Inner Content / Canvas */}
                      <div className="phone-screen-content">
                        <div className="artboard-header">
                          <h2 className="artboard-title" style={{ fontSize: "1.2rem" }}>{title || "Untitled Form"}</h2>
                          <p className="artboard-desc" style={{ fontSize: "0.82rem" }}>{description || "Please fill out this form."}</p>
                        </div>

                        {(syncViews ? nodes : mobileNodes).length === 0 ? (
                          <div className="canvas-empty-state">
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                              <line x1="12" y1="8" x2="12" y2="16" />
                              <line x1="8" y1="12" x2="16" y2="12" />
                            </svg>
                            <strong style={{ fontSize: "0.95rem" }}>Mobile Form is Empty</strong>
                            <span style={{ fontSize: "0.8rem" }}>Click any element from the left palette to add fields to this form.</span>
                          </div>
                        ) : (
                          (syncViews ? nodes : mobileNodes).map((node, idx) =>
                            renderNodeCard(node, idx, syncViews ? nodes : mobileNodes, true)
                          )
                        )}
                      </div>

                      {/* Bottom Home Indicator */}
                      <div className="phone-home-indicator" aria-hidden="true" />
                    </div>
                  </div>
                )}
              </div>
            </main>
          </div>
        )}

        {/* ==================================================================
            VIEW 2: FORMS CATALOG & TEMPLATES
            ================================================================== */}
        {activeTab === "catalog" && (
          <section className="card stack">
            <div className="row-between">
              <div>
                <h2>All Created Forms ({forms.length})</h2>
                <p className="notice">
                  Choose a published form to edit in the Studio, or start from an official company template.
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
                    <th>Versions</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {forms.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="notice" style={{ textAlign: "center", padding: "2rem" }}>
                        No forms created yet. Choose a template above or start drafting in Canvas Studio.
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
        )}

        {/* ==================================================================
            VIEW 3: DETAILED SETTINGS & ACCESS ALLOWLIST
            ================================================================== */}
        {activeTab === "settings" && (
          <section className="card stack">
            <div className="row-between">
              <div>
                <h2>Form Settings &amp; Access Policy</h2>
                <p className="notice">
                  Configure department routing, email allowlist, and submission lifecycle policies.
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
                <label>Associated Services (Operations)</label>
                <div className="row-actions" style={{ marginTop: "0.35rem" }}>
                  {services.length === 0 ? (
                    <span className="notice" style={{ fontSize: "0.85rem" }}>No company services defined yet.</span>
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
                  Email Allowlist (Leave empty so all active invited Users can access)
                </label>
                <textarea
                  id="fb-allowlist"
                  rows={3}
                  placeholder="Optional: one email per line. When populated, ONLY listed emails can view or submit this form."
                  value={allowlistText}
                  onChange={(e) => setAllowlistText(e.target.value)}
                />
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
