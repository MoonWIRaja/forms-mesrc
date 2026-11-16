"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ChunkLoader from "@/components/ChunkLoader";
import {
  PixelArrowLeftIcon,
  PixelArrowRightIcon,
  PixelLockIcon,
  PixelPauseIcon,
  PixelQuestionsIcon,
  PixelSparkleIcon,
} from "@/components/PixelIcons";
import {
  FORM_CATEGORIES,
  resolveFormCategory,
  type FormCategory,
  type FormRow,
  type FormTheme,
  type ServiceRow,
} from "@/lib/form-types";
import { getSupabase, type UserProfile } from "@/lib/supabase";

interface SubmissionRow {
  id: string;
  form_id: string;
  form_version: number;
  status: "draft" | "submitted";
  duration_seconds: number | null;
  submitted_at: string | null;
  created_at: string;
}

export default function FormsCatalogPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [forms, setForms] = useState<FormRow[]>([]);
  const [themesMap, setThemesMap] = useState<Record<string, FormTheme>>({});
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [formServiceMap, setFormServiceMap] = useState<Record<string, string[]>>({});
  const [mySubmissions, setMySubmissions] = useState<SubmissionRow[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<"all" | FormCategory>(() => {
    if (typeof window === "undefined") return "company_forms";
    const c = new URLSearchParams(window.location.search).get("category");
    if (c === "all" || c === "company_forms" || c === "staff_complaints" || c === "voting_evaluation") {
      return c;
    }
    return "company_forms";
  });
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        if (!uid) return;

        const [{ data: prof }, { data: fRows }, { data: sRows }, { data: fsRows }, { data: subRows }] =
          await Promise.all([
            supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
            supabase
              .from("forms")
              .select("*")
              .eq("state", "published")
              .order("title", { ascending: true }),
            supabase
              .from("services")
              .select("*")
              .eq("is_active", true)
              .order("sort_order", { ascending: true }),
            supabase.from("form_services").select("form_id,service_id"),
            supabase
              .from("submissions")
              .select("id,form_id,form_version,status,duration_seconds,submitted_at,created_at")
              .eq("user_id", uid)
              .order("created_at", { ascending: false }),
          ]);

        if (!active) return;
        const formList = (fRows as FormRow[] | null) ?? [];
        setProfile((prof as UserProfile | null) ?? null);
        setForms(formList);
        setServices((sRows as ServiceRow[] | null) ?? []);
        setMySubmissions((subRows as SubmissionRow[] | null) ?? []);

        if (formList.length > 0) {
          const { data: verRows } = await supabase
            .from("form_versions")
            .select("form_id,version_number,theme_json")
            .in(
              "form_id",
              formList.map((f) => f.id),
            )
            .eq("is_published", true);

          if (!active) return;
          const tMap: Record<string, FormTheme> = {};
          for (const f of formList) {
            const match = (
              verRows as { form_id: string; version_number: number; theme_json: FormTheme }[] | null
            )?.find(
              (v) =>
                v.form_id === f.id &&
                v.version_number === (f.current_published_version ?? f.latest_version),
            );
            if (match?.theme_json) tMap[f.id] = match.theme_json;
          }
          setThemesMap(tMap);
        }

        const map: Record<string, string[]> = {};
        for (const r of (fsRows as { form_id: string; service_id: string }[] | null) ?? []) {
          map[r.form_id] = [...(map[r.form_id] ?? []), r.service_id];
        }
        setFormServiceMap(map);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <ChunkLoader
        title="Forms Directory"
        subtitle="Loading published forms..."
      />
    );
  }

  if (!profile) {
    return (
      <section className="card stack">
        <h1>Sign In Required</h1>
        <p className="notice">
          Please sign in with your invited company email address to view and submit forms.
        </p>
        <div className="row-actions">
          <Link href="/sign-in/" className="pixel-paper-btn primary">
            Sign in with Email OTP
          </Link>
        </div>
      </section>
    );
  }

  const filteredForms = forms.filter((f) => {
    const fCat = resolveFormCategory(f, themesMap[f.id]);
    const catMatch = categoryFilter === "all" || fCat === categoryFilter;
    const svcMatch =
      serviceFilter === "all" || (formServiceMap[f.id] ?? []).includes(serviceFilter);
    return catMatch && svcMatch;
  });

  const formTitleById = Object.fromEntries(forms.map((f) => [f.id, f.title]));
  const activeCategoryMeta = FORM_CATEGORIES.find((c) => c.key === categoryFilter);

  return (
    <div className="stack">
      <div className="app-mobile-nav">
        <Link href="/" className="pixel-paper-btn compact">
          <PixelArrowLeftIcon size={13} />
          <span>Main Menu</span>
        </Link>
        <span className="app-mobile-nav-title">
          {activeCategoryMeta ? activeCategoryMeta.label : "All Forms"}
        </span>
        <div style={{ width: 40 }} />
      </div>

      <section className="card stack">
        <div className="row-between" style={{ alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.35rem" }}>
              <PixelQuestionsIcon size={18} />
              <span className="pixel-tag-pill">FORMS DIRECTORY</span>
            </div>
            <h1 style={{ margin: "0 0 0.25rem" }}>
              {activeCategoryMeta ? activeCategoryMeta.label : "All Published Forms"}
            </h1>
            <p className="notice" style={{ margin: 0 }}>
              Signed in as <strong>{profile.email}</strong> (Recorded automatically on submissions).
            </p>
          </div>

          <div className="field" style={{ minWidth: "200px" }}>
            <label htmlFor="cat-svc">Filter by Department / Service</label>
            <select
              id="cat-svc"
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
            >
              <option value="all">All Services</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="row-actions" style={{ gap: "0.45rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className={`pixel-paper-btn compact ${categoryFilter === "all" ? "primary" : ""}`}
            onClick={() => setCategoryFilter("all")}
          >
            All Categories ({forms.length})
          </button>
          {FORM_CATEGORIES.map((cat) => {
            const count = forms.filter(
              (f) => resolveFormCategory(f, themesMap[f.id]) === cat.key,
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
        </div>
      </section>

      {filteredForms.length === 0 ? (
        <section className="card">
          <p className="notice">No forms published in this category yet.</p>
        </section>
      ) : (
        <div className="grid-2">
          {filteredForms.map((f) => {
            const fTheme = themesMap[f.id];
            const accent = fTheme?.primaryColor || "#1d4ed8";
            const isPaused = Boolean(fTheme?.submissionsClosed);
            const fCat = resolveFormCategory(f, fTheme);
            const catLabel = FORM_CATEGORIES.find((c) => c.key === fCat)?.label ?? "General";

            return (
              <section
                key={f.id}
                className={`card stack catalog-form-card ${isPaused ? "paused" : ""}`}
                style={{
                  margin: 0,
                  borderTop: `6px solid ${isPaused ? "#94a3b8" : accent}`,
                }}
              >
                {fTheme?.bannerImageUrl && (
                  <div className="catalog-banner-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fTheme.bannerImageUrl} alt={f.title} />
                  </div>
                )}

                <div className="row-between" style={{ alignItems: "flex-start", gap: "0.5rem" }}>
                  <strong style={{ fontSize: "1.05rem" }}>{f.title}</strong>
                  {isPaused ? (
                    <span className="pixel-stamp-badge paused">
                      <PixelPauseIcon size={10} />
                      <span>CLOSED / PAUSED</span>
                    </span>
                  ) : (
                    <span className="pixel-stamp-badge live">
                      <PixelSparkleIcon size={10} />
                      <span>{catLabel}</span>
                    </span>
                  )}
                </div>

                {f.description && (
                  <p className="notice" style={{ margin: 0 }}>
                    {f.description}
                  </p>
                )}

                {isPaused && (
                  <div className="gf-paused-reason-strip">
                    <PixelLockIcon size={13} />
                    <span>
                      {fTheme?.closedReason || "Submissions are currently closed by administrator."}
                    </span>
                  </div>
                )}

                <div className="row-actions" style={{ marginTop: "auto", paddingTop: "0.4rem" }}>
                  {isPaused ? (
                    <button
                      type="button"
                      className="pixel-paper-btn"
                      disabled
                      aria-disabled="true"
                    >
                      <PixelLockIcon size={14} />
                      <span>Submissions Closed</span>
                    </button>
                  ) : (
                    <Link
                      href={`/forms/fill/?id=${encodeURIComponent(f.id)}`}
                      className="pixel-paper-btn primary"
                      style={{ backgroundColor: accent }}
                    >
                      <span>Open &amp; Fill Form</span>
                      <PixelArrowRightIcon size={14} />
                    </Link>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <section className="card stack">
        <h2>My Submissions &amp; Saved Drafts ({mySubmissions.length})</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Form</th>
                <th>Version</th>
                <th>Status</th>
                <th>Completion Time</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {mySubmissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="notice">
                    You have not saved or submitted any forms yet.
                  </td>
                </tr>
              ) : (
                mySubmissions.map((sub) => (
                  <tr key={sub.id}>
                    <td>{formTitleById[sub.form_id] ?? sub.form_id.slice(0, 8)}</td>
                    <td>v{sub.form_version}</td>
                    <td>
                      <span
                        className={`pixel-stamp-badge ${sub.status === "submitted" ? "live" : "draft"}`}
                      >
                        {sub.status.toUpperCase()}
                      </span>
                    </td>
                    <td>{sub.duration_seconds != null ? `${sub.duration_seconds}s` : "—"}</td>
                    <td>
                      {new Date(sub.submitted_at ?? sub.created_at).toLocaleString()}
                    </td>
                    <td>
                      {sub.status === "draft" && !themesMap[sub.form_id]?.submissionsClosed && (
                        <Link
                          href={`/forms/fill/?id=${encodeURIComponent(sub.form_id)}&draft=${encodeURIComponent(sub.id)}`}
                          className="pixel-paper-btn compact"
                        >
                          Resume Draft
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
