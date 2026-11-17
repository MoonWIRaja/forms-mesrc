"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import ChunkLoader from "@/components/ChunkLoader";
import {
  PixelArrowLeftIcon,
  PixelArrowRightIcon,
  PixelCatalogIcon,
  PixelLockIcon,
  PixelPauseIcon,
  PixelPlusIcon,
  PixelQuestionsIcon,
  PixelSparkleIcon,
  PixelStarIcon,
} from "@/components/PixelIcons";
import {
  resolveFormCategory,
  type FormRow,
  type FormTheme,
} from "@/lib/form-types";
import { getSupabase, type UserProfile } from "@/lib/supabase";

interface SubmissionRow {
  id: string;
  form_id: string;
  form_version: number;
  status: string;
  answers_json: Record<string, unknown>;
  submitted_at: string | null;
  created_at: string;
}

interface WednesdayScorePayload {
  speaker_slides: number;
  speaker_content: number;
  speaker_delivery: number;
  speaker_time: number;
  coordinator_technical: number;
  coordinator_readiness: number;
  emcee_protocol: number;
  emcee_clarity: number;
  feedback: string;
}

const DEFAULT_SCORES: WednesdayScorePayload = {
  speaker_slides: 8,
  speaker_content: 8,
  speaker_delivery: 8,
  speaker_time: 8,
  coordinator_technical: 8,
  coordinator_readiness: 8,
  emcee_protocol: 8,
  emcee_clarity: 8,
  feedback: "",
};

export default function VotingPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [votingForms, setVotingForms] = useState<FormRow[]>([]);
  const [themesMap, setThemesMap] = useState<Record<string, FormTheme>>({});
  const [myBallots, setMyBallots] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"events" | "my-ballots" | "wednesday">("events");

  // Weekly Wednesday quick scoring state
  const [scores, setScores] = useState<WednesdayScorePayload>(DEFAULT_SCORES);
  const [wedSaved, setWedSaved] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        if (!uid) return;

        const [{ data: prof }, { data: fRows }, { data: subRows }] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
          supabase
            .from("forms")
            .select("*")
            .eq("state", "published")
            .order("updated_at", { ascending: false }),
          supabase
            .from("submissions")
            .select("id,form_id,form_version,status,answers_json,submitted_at,created_at")
            .eq("user_id", uid)
            .eq("status", "submitted")
            .order("created_at", { ascending: false }),
        ]);

        if (!active) return;
        setProfile((prof as UserProfile | null) ?? null);

        const allForms = (fRows as FormRow[] | null) ?? [];
        const tMap: Record<string, FormTheme> = {};

        if (allForms.length > 0) {
          const { data: verRows } = await supabase
            .from("form_versions")
            .select("form_id,version_number,theme_json")
            .in(
              "form_id",
              allForms.map((f) => f.id),
            )
            .eq("is_published", true);

          if (!active) return;
          for (const f of allForms) {
            const match = (
              verRows as { form_id: string; version_number: number; theme_json: FormTheme }[] | null
            )?.find(
              (v) =>
                v.form_id === f.id &&
                v.version_number === (f.current_published_version ?? f.latest_version),
            );
            if (match?.theme_json) tMap[f.id] = match.theme_json;
          }
        }

        const filtered = allForms.filter(
          (f) => resolveFormCategory(f, tMap[f.id]) === "voting_evaluation",
        );
        const votingIds = new Set(filtered.map((f) => f.id));

        setThemesMap(tMap);
        setVotingForms(filtered);
        setMyBallots(
          ((subRows as SubmissionRow[] | null) ?? []).filter((s) => votingIds.has(s.form_id)),
        );
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
      <div className="center-stage">
        <ChunkLoader
          title="Voting & Evaluation"
          subtitle="Loading active judging ballots..."
        />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="center-stage">
        <section className="card stack" style={{ textAlign: "center", alignItems: "center" }}>
          <BrandLogo size="lg" subtitle="Voting & Evaluation" />
          <h1 style={{ fontSize: "1.25rem", margin: "0.55rem 0 0.2rem" }}>Sign in Required</h1>
          <p className="notice" style={{ maxWidth: "38ch" }}>
            Evaluation and judging sessions are invite-only. Sign in with your company email to continue.
          </p>
          <div className="row-actions" style={{ justifyContent: "center", marginTop: "0.5rem" }}>
            <Link href="/sign-in/" className="pixel-paper-btn primary">
              <span>Sign in with Email OTP</span>
              <PixelArrowRightIcon size={14} />
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const isStaff = profile.role === "admin" || profile.role === "maintenance";
  const formMap = Object.fromEntries(votingForms.map((f) => [f.id, f]));
  const wedTotal =
    scores.speaker_slides +
    scores.speaker_content +
    scores.speaker_delivery +
    scores.speaker_time +
    scores.coordinator_technical +
    scores.coordinator_readiness +
    scores.emcee_protocol +
    scores.emcee_clarity;

  return (
    <div className="stack" style={{ maxWidth: "980px", margin: "0 auto", width: "100%" }}>
      <div className="app-mobile-nav">
        <Link href="/" className="pixel-paper-btn compact">
          <PixelArrowLeftIcon size={13} />
          <span>Main Menu</span>
        </Link>
        <span className="app-mobile-nav-title">Voting &amp; Evaluation</span>
        <div style={{ width: 40 }} />
      </div>

      {/* HEADER */}
      <section className="card stack">
        <div className="row-between" style={{ alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.35rem" }}>
              <PixelStarIcon size={18} />
              <span className="pixel-tag-pill">JUDGING &amp; VOTING PORTAL</span>
            </div>
            <h1 style={{ margin: "0 0 0.25rem" }}>Voting &amp; Evaluation</h1>
            <p className="notice" style={{ margin: 0 }}>
              Submit official jury star ratings and scores (such as Finalis MCEP) as{" "}
              <strong>{profile.email}</strong>.
            </p>
          </div>

          <div className="row-actions" style={{ gap: "0.5rem" }}>
            {isStaff && (
              <Link href="/admin/forms/" className="pixel-paper-btn compact primary">
                <PixelPlusIcon size={13} />
                <span>Create Voting Form in Studio</span>
              </Link>
            )}
            <Link href="/" className="pixel-paper-btn compact">
              <PixelArrowLeftIcon size={13} />
              <span>Home</span>
            </Link>
          </div>
        </div>

        <div className="row-actions" style={{ gap: "0.45rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className={`pixel-paper-btn compact ${activeTab === "events" ? "primary" : ""}`}
            onClick={() => setActiveTab("events")}
          >
            <PixelStarIcon size={13} />
            <span>Judging Events ({votingForms.length})</span>
          </button>
          <button
            type="button"
            className={`pixel-paper-btn compact ${activeTab === "my-ballots" ? "primary" : ""}`}
            onClick={() => setActiveTab("my-ballots")}
          >
            <PixelCatalogIcon size={13} />
            <span>My Submitted Votes ({myBallots.length})</span>
          </button>
          <button
            type="button"
            className={`pixel-paper-btn compact ${activeTab === "wednesday" ? "primary" : ""}`}
            onClick={() => setActiveTab("wednesday")}
          >
            <PixelQuestionsIcon size={13} />
            <span>Weekly Presentation Rubric</span>
          </button>
        </div>
      </section>

      {/* TAB 1: VOTING & JUDGING FORMS BUILT IN FORM STUDIO */}
      {activeTab === "events" && (
        <>
          {votingForms.length === 0 ? (
            <section className="card stack" style={{ textAlign: "center", padding: "2.5rem 1.5rem" }}>
              <PixelStarIcon size={32} />
              <h2 style={{ margin: "0.25rem 0" }}>No Active Voting Forms Published Yet</h2>
              <p className="notice" style={{ maxWidth: "46ch", margin: "0 auto" }}>
                Administrators can build custom voting and star-rating forms (like{" "}
                <strong>Finalis MCEP</strong>) in Form Studio under the{" "}
                <strong>Voting &amp; Evaluation</strong> category.
              </p>
              {isStaff && (
                <div className="row-actions" style={{ justifyContent: "center", marginTop: "0.75rem" }}>
                  <Link href="/admin/forms/" className="pixel-paper-btn primary">
                    <PixelPlusIcon size={14} />
                    <span>Launch Form Studio &amp; Pick Finalis MCEP Template</span>
                  </Link>
                </div>
              )}
            </section>
          ) : (
            <div className="grid-2">
              {votingForms.map((f) => {
                const fTheme = themesMap[f.id];
                const accent = fTheme?.primaryColor || "#7c3aed";
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

                      <div className="row-between" style={{ alignItems: "flex-start", gap: "0.5rem" }}>
                        <strong style={{ fontSize: "1.08rem", color: "var(--ink)" }}>{f.title}</strong>
                        <span className="pixel-stamp-badge paused">
                          <PixelPauseIcon size={10} />
                          <span>VOTING CLOSED</span>
                        </span>
                      </div>

                      {f.description && (
                        <p className="notice" style={{ margin: 0 }}>
                          {f.description}
                        </p>
                      )}

                      <div className="gf-paused-reason-strip">
                        <PixelLockIcon size={13} />
                        <span>
                          {fTheme?.closedReason || "Voting window has been closed by Admin."}
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
                      <strong style={{ fontSize: "1.08rem", color: "var(--ink)" }}>{f.title}</strong>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                        <span className="pixel-stamp-badge live">
                          <PixelSparkleIcon size={10} />
                          <span>OPEN FOR JUDGES</span>
                        </span>
                        <PixelArrowRightIcon size={15} />
                      </div>
                    </div>

                    {f.description && (
                      <p className="notice" style={{ margin: 0 }}>
                        {f.description}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 2: MY SUBMITTED VOTES & SCORES */}
      {activeTab === "my-ballots" && (
        <section className="card stack">
          <h2 style={{ margin: 0 }}>My Submitted Ballots ({myBallots.length})</h2>
          {myBallots.length === 0 ? (
            <p className="notice">
              You have not submitted any voting ballots yet. Switch to Judging Events to participate.
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Event / Form</th>
                    <th>Version</th>
                    <th>Recorded Answers</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {myBallots.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <strong>{formMap[b.form_id]?.title ?? "Voting Form"}</strong>
                      </td>
                      <td>v{b.form_version}</td>
                      <td>
                        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                          {Object.entries(b.answers_json ?? {}).map(([k, v]) => (
                            <span key={k} className="pixel-tag-pill">
                              {String(v)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>{new Date(b.submitted_at ?? b.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: WEEKLY WEDNESDAY PRESENTATION GRADING */}
      {activeTab === "wednesday" && (
        <section className="card stack">
          <div className="row-between">
            <div>
              <h2 style={{ margin: 0 }}>Weekly Wednesday Presentation Quick Rubric</h2>
              <p className="notice" style={{ margin: "0.2rem 0 0" }}>
                Quick role-by-role 1–10 scoring sheet.
              </p>
            </div>
            <span className="pixel-stamp-badge live">
              <PixelStarIcon size={11} />
              <span>SCORE: {wedTotal} / 80</span>
            </span>
          </div>

          {wedSaved ? (
            <div className="alert alert-ok" role="status">
              Weekly presentation score ({wedTotal} / 80) saved locally. Create a published form under
              Voting &amp; Evaluation for centralized database leaderboards!
            </div>
          ) : null}

          <div className="grid-2">
            <div className="field">
              <label>Speaker Slides ({scores.speaker_slides}/10)</label>
              <input
                type="range"
                min={1}
                max={10}
                value={scores.speaker_slides}
                onChange={(e) => setScores({ ...scores, speaker_slides: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Speaker Content ({scores.speaker_content}/10)</label>
              <input
                type="range"
                min={1}
                max={10}
                value={scores.speaker_content}
                onChange={(e) => setScores({ ...scores, speaker_content: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Speaker Delivery ({scores.speaker_delivery}/10)</label>
              <input
                type="range"
                min={1}
                max={10}
                value={scores.speaker_delivery}
                onChange={(e) => setScores({ ...scores, speaker_delivery: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Emcee Clarity ({scores.emcee_clarity}/10)</label>
              <input
                type="range"
                min={1}
                max={10}
                value={scores.emcee_clarity}
                onChange={(e) => setScores({ ...scores, emcee_clarity: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="row-actions">
            <button
              type="button"
              className="pixel-paper-btn primary"
              onClick={() => setWedSaved(true)}
            >
              <PixelStarIcon size={14} />
              <span>Record Rubric Score ({wedTotal}/80)</span>
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
