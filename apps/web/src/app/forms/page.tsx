"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ChunkLoader from "@/components/ChunkLoader";
import {
  PixelArrowLeftIcon,
  PixelArrowRightIcon,
  PixelLockIcon,
  PixelPauseIcon,
} from "@/components/PixelIcons";
import {
  FORM_CATEGORIES,
  resolveFormCategory,
  type FormCategory,
  type FormRow,
  type FormTheme,
} from "@/lib/form-types";
import { getSupabase, type UserProfile } from "@/lib/supabase";

export default function FormsCatalogPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [forms, setForms] = useState<FormRow[]>([]);
  const [themesMap, setThemesMap] = useState<Record<string, FormTheme>>({});
  const [categoryFilter] = useState<"all" | FormCategory>(() => {
    if (typeof window === "undefined") return "company_forms";
    const c = new URLSearchParams(window.location.search).get("category");
    if (c === "all" || c === "company_forms" || c === "staff_complaints" || c === "voting_evaluation") {
      return c;
    }
    return "company_forms";
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        if (!uid) return;

        const [{ data: prof }, { data: fRows }] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
          supabase
            .from("forms")
            .select("*")
            .eq("state", "published")
            .order("title", { ascending: true }),
        ]);

        if (!active) return;
        const formList = (fRows as FormRow[] | null) ?? [];
        setProfile((prof as UserProfile | null) ?? null);
        setForms(formList);

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
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <ChunkLoader title="Company Forms" subtitle="Loading forms..." />;
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
    return categoryFilter === "all" || fCat === categoryFilter;
  });

  const activeCategoryMeta = FORM_CATEGORIES.find((c) => c.key === categoryFilter);

  return (
    <div className="stack">
      <div className="app-mobile-nav">
        <Link href="/" className="pixel-paper-btn compact">
          <PixelArrowLeftIcon size={13} />
          <span>Main Menu</span>
        </Link>
        <span className="app-mobile-nav-title">
          {activeCategoryMeta ? activeCategoryMeta.label : "Forms"}
        </span>
        <div style={{ width: 40 }} />
      </div>

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

            if (isPaused) {
              return (
                <section
                  key={f.id}
                  className="card stack catalog-form-card paused"
                  style={{
                    margin: 0,
                    borderTop: "6px solid #94a3b8",
                  }}
                >
                  {fTheme?.bannerImageUrl && (
                    <div className="catalog-banner-thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={fTheme.bannerImageUrl} alt={f.title} />
                    </div>
                  )}

                  <div className="row-between" style={{ alignItems: "center", gap: "0.5rem" }}>
                    <strong style={{ fontSize: "1.05rem", color: "var(--ink)" }}>{f.title}</strong>
                    <span className="pixel-stamp-badge paused">
                      <PixelPauseIcon size={10} />
                      <span>CLOSED</span>
                    </span>
                  </div>

                  <div className="gf-paused-reason-strip">
                    <PixelLockIcon size={13} />
                    <span>
                      {fTheme?.closedReason || "Submissions are currently closed."}
                    </span>
                  </div>
                </section>
              );
            }

            return (
              <Link
                key={f.id}
                href={`/forms/fill/?id=${encodeURIComponent(f.id)}`}
                className="card stack catalog-form-card"
                style={{
                  margin: 0,
                  borderTop: `6px solid ${accent}`,
                  textDecoration: "none",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                {fTheme?.bannerImageUrl && (
                  <div className="catalog-banner-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fTheme.bannerImageUrl} alt={f.title} />
                  </div>
                )}

                <div className="row-between" style={{ alignItems: "center", gap: "0.5rem" }}>
                  <strong style={{ fontSize: "1.05rem", color: "var(--ink)" }}>{f.title}</strong>
                  <PixelArrowRightIcon size={16} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
