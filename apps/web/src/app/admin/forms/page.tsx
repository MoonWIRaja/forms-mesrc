"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ChunkLoader from "@/components/ChunkLoader";
import FormRenderer from "@/components/FormRenderer";
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

const PALETTE: { type: FieldType; label: string }[] = [
  { type: "heading", label: "Heading" },
  { type: "instructions", label: "Instructions" },
  { type: "section", label: "Section Divider" },
  { type: "short_text", label: "Short Text" },
  { type: "long_text", label: "Long Text" },
  { type: "email", label: "Email" },
  { type: "number", label: "Number" },
  { type: "date", label: "Date" },
  { type: "dropdown", label: "Dropdown" },
  { type: "single_choice", label: "Single Choice" },
  { type: "multiple_choice", label: "Multiple Choice" },
  { type: "file_upload", label: "File Upload (1 GiB)" },
];

export default function AdminFormBuilderPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [forms, setForms] = useState<FormRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [title, setTitle] = useState("New Company Form");
  const [slug, setSlug] = useState("new-company-form");
  const [description, setDescription] = useState("");
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

  const seqRef = useRef(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState<"none" | "phone" | "desktop">("none");
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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
        setNodes(((ver as { schema_json: FormFieldNode[] }).schema_json ?? []) as FormFieldNode[]);
        setTheme(((ver as { theme_json: FormTheme }).theme_json ?? {}) as FormTheme);
      }
      setSelectedNodeId(null);
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
    seqRef.current += 1; setSlug(`${tpl.slug}-${forms.length + seqRef.current}`);
    setDescription(tpl.description);
    setKind(tpl.kind);
    setAllowAppeal(tpl.allowAppeal);
    setNodes(tpl.nodes.map((n) => ({ ...n })));
    setSelectedNodeId(null);
    setInfo(`Loaded template: ${tpl.name}`);
  }

  function handleAddNode(type: FieldType) {
    seqRef.current += 1; const id = `fld_${nodes.length + seqRef.current}`;
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
    setSelectedNodeId(id);
  }

  function handleMoveNode(fromIdx: number, toIdx: number) {
    if (toIdx < 0 || toIdx >= nodes.length || fromIdx === toIdx) return;
    const copy = [...nodes];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    setNodes(copy);
  }

  function handleDeleteNode(id: string) {
    setNodes((prev) => prev.filter((n) => n.id !== id));
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

      const { data: pubRes, error: pubErr } = await supabase.rpc("publish_form_version", {
        p_form_id: formId,
      });
      if (pubErr) throw pubErr;
      const pub = pubRes as { published_version: number };
      setInfo(
        `Published immutable version v${pub.published_version}. Future edits will automatically create a new draft version.`,
      );
      await refreshFormsList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish form.");
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive(formId: string) {
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { error: rpcErr } = await supabase.rpc("set_form_state", {
        p_form_id: formId,
        p_state: "archived",
      });
      if (rpcErr) throw rpcErr;
      setInfo("Form archived. Existing submissions remain preserved.");
      await refreshFormsList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive form.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <ChunkLoader
        title="SPAWNING VISUAL FORM BUILDER..."
        subtitle="Loading workbench, field palette, and immutable versions"
        variant="both"
      />
    );
  }

  if (!profile || (profile.role !== "admin" && profile.role !== "maintenance")) {
    return (
      <section className="card stack">
        <h1>Access Denied</h1>
        <p className="notice">Only Admin or Maintenance accounts can build or publish forms.</p>
      </section>
    );
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  return (
    <div className="stack">
      <section className="card row-between">
        <div>
          <h1>Visual Form Builder &amp; Version Manager</h1>
          <p className="notice">
            Build mobile-first forms with templates, drag-and-drop canvas nodes, email allowlists,
            and immutable published versions.
          </p>
        </div>
        <div className="row-actions">
          <Link href="/admin/" className="btn btn-secondary">
            Back to Admin Workspace
          </Link>
        </div>
      </section>

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

      <section className="card stack">
        <div className="row-between">
          <h2>Existing Forms ({forms.length})</h2>
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
                  <td colSpan={6} className="notice">
                    No forms created yet. Choose a template above or save the form below.
                  </td>
                </tr>
              ) : (
                forms.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <strong>{f.title}</strong>
                    </td>
                    <td>
                      <code>{f.slug}</code>
                    </td>
                    <td>{f.kind}</td>
                    <td>
                      <span
                        className={`badge ${f.state === "published" ? "badge-configured" : "badge-not_configured"}`}
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
                        className="btn-link"
                        onClick={() => handleSelectExistingForm(f)}
                      >
                        Edit in Builder
                      </button>
                      {f.state !== "archived" && (
                        <button
                          type="button"
                          className="btn-link"
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

      <section className="card stack">
        <h2>
          Form Settings &amp; Access Policy{" "}
          {selectedFormId ? `(Editing ID: ${selectedFormId.slice(0, 8)}...)` : "(New Form)"}
        </h2>

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
          <input
            id="fb-desc"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="fb-kind">Form Category / Workflow Kind</label>
            <select
              id="fb-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as FormKind)}
            >
              <option value="general">General Form</option>
              <option value="appeal_enabled">Appeal-Enabled Form</option>
              <option value="complaint">Complaint Ticket Form</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="fb-color">Brand Accent Color</label>
            <select
              id="fb-color"
              value={theme.primaryColor ?? "#1d4ed8"}
              onChange={(e) => setTheme({ ...theme, primaryColor: e.target.value })}
            >
              <option value="#1d4ed8">Royal Blue (#1d4ed8)</option>
              <option value="#0f766e">Teal (#0f766e)</option>
              <option value="#7c3aed">Violet (#7c3aed)</option>
              <option value="#b45309">Amber (#b45309)</option>
              <option value="#be123c">Crimson (#be123c)</option>
              <option value="#111827">Slate (#111827)</option>
            </select>
          </div>
        </div>

        <div className="row-actions">
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <input
              type="checkbox"
              checked={allowSaveDraft}
              onChange={(e) => setAllowSaveDraft(e.target.checked)}
            />
            Allow Users to save draft before submitting
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <input
              type="checkbox"
              checked={allowAppeal}
              onChange={(e) => setAllowAppeal(e.target.checked)}
            />
            Enable formal appeal review on submissions
          </label>
        </div>

        <div className="grid-2">
          <div className="field">
            <label>Associated Company Services (for filtering &amp; reporting)</label>
            <div className="row-actions">
              {services.map((svc) => {
                const checked = selectedServices.includes(svc.id);
                return (
                  <label
                    key={svc.id}
                    style={{
                      fontWeight: 400,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setSelectedServices((prev) =>
                          e.target.checked ? [...prev, svc.id] : prev.filter((x) => x !== svc.id),
                        )
                      }
                    />
                    {svc.name}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="field">
            <label htmlFor="fb-allowlist">
              Email Allowlist (Leave empty so all active invited Users can access)
            </label>
            <textarea
              id="fb-allowlist"
              rows={3}
              placeholder="Optional: one email per line. When populated, ONLY listed emails can view or submit this form (enforced by RLS)."
              value={allowlistText}
              onChange={(e) => setAllowlistText(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="card stack">
        <div className="row-between">
          <h2>Canvas, Node Tree &amp; Property Editor</h2>
          <div className="row-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPreviewMode(previewMode === "phone" ? "none" : "phone")}
            >
              {previewMode === "phone" ? "Close Phone Preview" : "Phone Preview (375px)"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPreviewMode(previewMode === "desktop" ? "none" : "desktop")}
            >
              {previewMode === "desktop" ? "Close Desktop Preview" : "Desktop Preview"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={handleSaveDraft}
            >
              Save Draft Version
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={handlePublish}
            >
              Publish Immutable Version
            </button>
          </div>
        </div>

        <div className="row-actions">
          {PALETTE.map((item) => (
            <button
              key={item.type}
              type="button"
              className="btn btn-secondary"
              style={{ padding: "0.35rem 0.65rem", fontSize: "0.85rem" }}
              onClick={() => handleAddNode(item.type)}
            >
              + {item.label}
            </button>
          ))}
        </div>

        <div className="grid-2">
          <div className="stack">
            <h3>Canvas Nodes (Drag to reorder or click to inspect)</h3>
            {nodes.map((node, idx) => (
              <div
                key={node.id}
                draggable
                onDragStart={() => setDragIndex(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) handleMoveNode(dragIndex, idx);
                  setDragIndex(null);
                }}
                onClick={() => setSelectedNodeId(node.id)}
                className="card"
                style={{
                  margin: 0,
                  padding: "0.75rem",
                  cursor: "grab",
                  borderColor: selectedNodeId === node.id ? "var(--primary)" : "var(--border)",
                  borderWidth: selectedNodeId === node.id ? "2px" : "1px",
                }}
              >
                <div className="row-between">
                  <div>
                    <strong>{node.label}</strong>{" "}
                    <span className="notice" style={{ fontSize: "0.8rem" }}>
                      ({node.type}
                      {node.required ? ", required" : ""})
                    </span>
                  </div>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveNode(idx, idx - 1);
                      }}
                    >
                      &uarr;
                    </button>
                    <button
                      type="button"
                      className="btn-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveNode(idx, idx + 1);
                      }}
                    >
                      &darr;
                    </button>
                    <button
                      type="button"
                      className="btn-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNode(node.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="stack">
            <h3>Node Property Inspector</h3>
            {!selectedNode ? (
              <p className="notice">Select any node on the canvas to configure its properties.</p>
            ) : (
              <div className="card stack" style={{ margin: 0 }}>
                <div className="field">
                  <label htmlFor="np-label">Label / Text</label>
                  <input
                    id="np-label"
                    type="text"
                    value={selectedNode.label}
                    onChange={(e) =>
                      setNodes((prev) =>
                        prev.map((n) =>
                          n.id === selectedNode.id ? { ...n, label: e.target.value } : n,
                        ),
                      )
                    }
                  />
                </div>

                {selectedNode.type !== "heading" &&
                  selectedNode.type !== "instructions" &&
                  selectedNode.type !== "section" && (
                    <>
                      <div className="field">
                        <label htmlFor="np-help">Help Text</label>
                        <input
                          id="np-help"
                          type="text"
                          value={selectedNode.helpText ?? ""}
                          onChange={(e) =>
                            setNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode.id ? { ...n, helpText: e.target.value } : n,
                              ),
                            )
                          }
                        />
                      </div>

                      <div className="field">
                        <label htmlFor="np-ph">Placeholder</label>
                        <input
                          id="np-ph"
                          type="text"
                          value={selectedNode.placeholder ?? ""}
                          onChange={(e) =>
                            setNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode.id
                                  ? { ...n, placeholder: e.target.value }
                                  : n,
                              ),
                            )
                          }
                        />
                      </div>

                      <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <input
                          type="checkbox"
                          checked={Boolean(selectedNode.required)}
                          onChange={(e) =>
                            setNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode.id
                                  ? { ...n, required: e.target.checked }
                                  : n,
                              ),
                            )
                          }
                        />
                        Required field
                      </label>
                    </>
                  )}

                {(selectedNode.type === "dropdown" ||
                  selectedNode.type === "single_choice" ||
                  selectedNode.type === "multiple_choice") && (
                  <div className="field">
                    <label htmlFor="np-opts">Choices (one per line)</label>
                    <textarea
                      id="np-opts"
                      rows={4}
                      value={(selectedNode.options ?? []).join("\n")}
                      onChange={(e) =>
                        setNodes((prev) =>
                          prev.map((n) =>
                            n.id === selectedNode.id
                              ? {
                                  ...n,
                                  options: e.target.value
                                    .split("\n")
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                }
                              : n,
                          ),
                        )
                      }
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {previewMode !== "none" && (
          <div
            className="card stack"
            style={{
              maxWidth: previewMode === "phone" ? "390px" : "100%",
              margin: "1rem auto 0",
              border: "2px solid var(--primary)",
            }}
          >
            <div className="row-between">
              <strong>
                {previewMode === "phone" ? "Mobile Preview (375px)" : "Desktop Preview"}: {title}
              </strong>
              <span className="badge badge-configured">Interactive Preview</span>
            </div>
            {description && <p className="notice">{description}</p>}
            <FormRenderer
              nodes={nodes}
              theme={theme}
              answers={previewAnswers}
              onChange={(fid, val) => setPreviewAnswers((prev) => ({ ...prev, [fid]: val }))}
            />
          </div>
        )}
      </section>
    </div>
  );
}