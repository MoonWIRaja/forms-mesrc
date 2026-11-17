"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ChunkLoader from "@/components/ChunkLoader";
import {
  PixelArrowRightIcon,
  PixelPauseIcon,
  PixelPlayIcon,
  PixelSparkleIcon,
  PixelTrashIcon,
} from "@/components/PixelIcons";
import {
  FORM_CATEGORIES,
  resolveFormCategory,
  type FormCategory,
  type FormFieldNode,
  type FormRow,
  type FormTheme,
} from "@/lib/form-types";
import { getSupabase, type UserProfile } from "@/lib/supabase";

export default function AdminFormsListPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [forms, setForms] = useState<FormRow[]>([]);
  const [themesMap, setThemesMap] = useState<Record<string, FormTheme>>({});
  const [categoryFilter, setCategoryFilter] = useState<"all" | FormCategory | "archived">("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function loadAllForms() {
    const supabase = getSupabase();
    const { data: fRows } = await supabase
      .from("forms")
      .select("*")
      .order("updated_at", { ascending: false });
    const fList = (fRows as FormRow[] | null) ?? [];
    setForms(fList);

    if (fList.length > 0) {
      const { data: vRows } = await supabase
        .from("form_versions")
        .select("form_id,version_number,theme_json")
        .in(
          "form_id",
          fList.map((f) => f.id),
        );
      const tMap: Record<string, FormTheme> = {};
      for (const f of fList) {
        const match = (
          vRows as { form_id: string; version_number: number; theme_json: FormTheme }[] | null
        )?.find((v) => v.form_id === f.id && v.version_number === f.latest_version);
        if (match?.theme_json) tMap[f.id] = match.theme_json;
      }
      setThemesMap(tMap);
    }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        if (!uid) return;
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", uid)
          .maybeSingle();
        if (!active) return;
        setProfile((prof as UserProfile | null) ?? null);
        await loadAllForms();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handlePublishOrPause(f: FormRow, shouldPause: boolean) {
    setBusyId(f.id);
    setError(null);
    setInfo(null);
    try {
      const supabase = getSupabase();
      const { data: ver } = await supabase
        .from("form_versions")
        .select("*")
        .eq("form_id", f.id)
        .eq("version_number", f.latest_version)
        .maybeSingle();

      const verSchema =
        ((ver as { schema_json?: FormFieldNode[] } | null)?.schema_json ?? []) as FormFieldNode[];
      const verTheme = ((ver as { theme_json?: FormTheme } | null)?.theme_json ?? {}) as FormTheme;
      const nextTheme: FormTheme = {
        ...verTheme,
        submissionsClosed: shouldPause,
        closedReason: shouldPause ? "Entries paused by administrator." : "",
      };

      const { error: saveErr } = await supabase.rpc("save_form_builder", {
        p_form_id: f.id,
        p_slug: f.slug,
        p_title: f.title,
        p_description: f.description,
        p_kind: f.kind,
        p_allow_save_draft: f.allow_save_draft,
        p_allow_appeal: f.allow_appeal,
        p_service_ids: [],
        p_allowlist_emails: [],
        p_schema_json: verSchema,
        p_theme_json: nextTheme,
      });
      if (saveErr) throw saveErr;

      const { error: pubErr } = await supabase.rpc("publish_form_version", { p_form_id: f.id });
      if (pubErr) throw pubErr;

      setInfo(
        shouldPause
          ? `"${f.title}" is now PAUSED (card remains visible on dashboard as Closed).`
          : `"${f.title}" is now LIVE and open for submissions!`,
      );
      await loadAllForms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update form status.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteOrRestore(f: FormRow, restore: boolean) {
    const label = restore ? "restore this form to drafts" : "delete (archive) this form";
    if (!confirm(`Are you sure you want to ${label}?`)) return;
    setBusyId(f.id);
    setError(null);
    setInfo(null);
    try {
      const supabase = getSupabase();
      const { error: rpcErr } = await supabase.rpc("set_form_state", {
        p_form_id: f.id,
        p_state: restore ? "draft" : "archived",
      });
      if (rpcErr) throw rpcErr;
      setInfo(restore ? `"${f.title}" restored to Drafts.` : `"${f.title}" deleted / archived.`);
      await loadAllForms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update form.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <ChunkLoader title="Forms" subtitle="Loading all forms..." />;
  }

  if (!profile || (profile.role !== "admin" && profile.role !== "maintenance")) {
    return (
      <div className="center-stage">
        <section className="card stack">
          <h1>Access Restricted</h1>
          <p className="notice">Only Admin or Maintenance accounts may manage forms.</p>
          <div className="row-actions">
            <Link href="/" className="pixel-paper-btn primary">
              Return Home
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const filteredForms = forms.filter((f) => {
    if (categoryFilter === "archived") return f.state === "archived";
    if (f.state === "archived") return false;
    if (categoryFilter === "all") return true;
    return resolveFormCategory(f, themesMap[f.id]) === categoryFilter;
  });

  return (
    <div className="stack" style={{ flex: 1 }}>
      <section
        className="card stack admin-full-card"
        style={{ flex: 1, height: "calc(100dvh - 2.5rem)", margin: 0, overflow: "hidden" }}
      >
        <div className="row-between" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <h2 style={{ margin: 0 }}>All Forms ({filteredForms.length})</h2>
          <div className="row-actions" style={{ gap: "0.45rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className={`pixel-paper-btn compact ${categoryFilter === "all" ? "primary" : ""}`}
              onClick={() => setCategoryFilter("all")}
            >
              All Active ({forms.filter((f) => f.state !== "archived").length})
            </button>
            {FORM_CATEGORIES.map((cat) => {
              const count = forms.filter(
                (f) => f.state !== "archived" && resolveFormCategory(f, themesMap[f.id]) === cat.key,
              ).length;
              return (
                <button
                  key={cat.key}
                  type="button"
                  className={`pixel-paper-btn compact ${categoryFilter === cat.key ? "primary" : ""}`}
                  onClick={() => setCategoryFilter(cat.key)}
                >
                  {cat.label} ({count})
                </button>
              );
            })}
            <button
              type="button"
              className={`pixel-paper-btn compact ${categoryFilter === "archived" ? "primary" : ""}`}
              onClick={() => setCategoryFilter("archived")}
            >
              Archived ({forms.filter((f) => f.state === "archived").length})
            </button>
          </div>
        </div>

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

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "2px 4px" }}>
          {filteredForms.length === 0 ? (
            <div className="gf-empty-stream-card">
              <p className="notice" style={{ margin: 0 }}>
                No forms in this filter yet.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))",
                gap: "1rem",
              }}
            >
              {filteredForms.map((f) => {
                const fTheme = themesMap[f.id];
                const fCat = resolveFormCategory(f, fTheme);
                const catLabel = FORM_CATEGORIES.find((c) => c.key === fCat)?.label ?? fCat;
                const isPaused = f.state === "published" && Boolean(fTheme?.submissionsClosed);
                const isBusy = busyId === f.id;
                const accent = fTheme?.primaryColor || "#1d4ed8";

                return (
                  <div
                    key={f.id}
                    className={`card stack catalog-form-card ${isPaused ? "paused" : ""}`}
                    style={{
                      margin: 0,
                      borderTop: `6px solid ${isPaused ? "#94a3b8" : accent}`,
                      padding: "1rem 1.15rem",
                    }}
                  >
                    {fTheme?.bannerImageUrl && (
                      <div className="catalog-banner-thumb" style={{ height: "96px" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={fTheme.bannerImageUrl} alt={f.title} />
                      </div>
                    )}

                    <div className="row-between" style={{ alignItems: "flex-start", gap: "0.5rem" }}>
                      <div>
                        <strong style={{ color: "var(--ink)", fontSize: "1.02rem" }}>{f.title}</strong>
                        <div style={{ fontSize: "0.74rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                          <code>{f.slug}</code>
                        </div>
                      </div>
                      {f.state === "archived" ? (
                        <span className="pixel-stamp-badge draft">ARCHIVED</span>
                      ) : isPaused ? (
                        <span className="pixel-stamp-badge paused">
                          <PixelPauseIcon size={10} />
                          <span>PAUSED</span>
                        </span>
                      ) : f.state === "published" ? (
                        <span className="pixel-stamp-badge live">
                          <PixelSparkleIcon size={10} />
                          <span>LIVE</span>
                        </span>
                      ) : (
                        <span className="pixel-stamp-badge draft">DRAFT</span>
                      )}
                    </div>

                    <div className="row-between" style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                      <span className="pixel-tag-pill">{catLabel}</span>
                      <span>
                        v{f.latest_version}{" "}
                        {f.current_published_version ? `(Live v${f.current_published_version})` : ""}
                      </span>
                    </div>

                    <div className="row-actions" style={{ gap: "0.4rem", flexWrap: "wrap", marginTop: "auto", paddingTop: "0.35rem" }}>
                      <Link
                        href={`/admin/forms/?id=${encodeURIComponent(f.id)}`}
                        className="pixel-paper-btn compact primary"
                      >
                        <span>Edit in Craft</span>
                        <PixelArrowRightIcon size={12} />
                      </Link>

                      {f.state === "published" && !isPaused ? (
                        <button
                          type="button"
                          className="pixel-paper-btn compact warning"
                          disabled={isBusy}
                          onClick={() => void handlePublishOrPause(f, true)}
                        >
                          <PixelPauseIcon size={12} />
                          <span>Pause</span>
                        </button>
                      ) : f.state !== "archived" ? (
                        <button
                          type="button"
                          className="pixel-paper-btn compact"
                          disabled={isBusy}
                          onClick={() => void handlePublishOrPause(f, false)}
                        >
                          <PixelPlayIcon size={12} />
                          <span>Publish</span>
                        </button>
                      ) : null}

                      {f.state !== "archived" ? (
                        <button
                          type="button"
                          className="pixel-paper-btn compact danger"
                          disabled={isBusy}
                          onClick={() => void handleDeleteOrRestore(f, false)}
                        >
                          <PixelTrashIcon size={12} />
                          <span>Delete</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="pixel-paper-btn compact"
                          disabled={isBusy}
                          onClick={() => void handleDeleteOrRestore(f, true)}
                        >
                          <span>Restore</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
