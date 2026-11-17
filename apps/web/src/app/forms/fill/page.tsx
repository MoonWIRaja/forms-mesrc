"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ChunkLoader from "@/components/ChunkLoader";
import FormRenderer from "@/components/FormRenderer";
import {
  PixelArrowLeftIcon,
  PixelArrowRightIcon,
  PixelCheckIcon,
  PixelLockIcon,
  PixelPauseIcon,
  PixelSaveIcon,
  PixelShieldAlertIcon,
} from "@/components/PixelIcons";
import {
  getFormBackgroundPatternCss,
  getFormBackgroundPatternSize,
  getLocalNowParts,
  resolveFormCategory,
  type FormFieldNode,
  type FormRow,
  type FormTheme,
} from "@/lib/form-types";
import { getSupabase, type UserProfile } from "@/lib/supabase";

function buildDefaultAnswers(
  fieldNodes: FormFieldNode[],
  userEmail?: string,
): Record<string, unknown> {
  const nowParts = getLocalNowParts();
  const initial: Record<string, unknown> = {};
  for (const n of fieldNodes) {
    if (n.type === "date_time" && n.defaultToNow !== false) {
      initial[n.id] = nowParts.dateTime;
    } else if (n.type === "time" && n.defaultToNow !== false) {
      initial[n.id] = nowParts.time;
    } else if (n.type === "date" && n.defaultToNow) {
      initial[n.id] = nowParts.date;
    } else if (n.type === "email" && userEmail) {
      initial[n.id] = userEmail;
    }
  }
  return initial;
}

function summarizeSubmissionReason(
  fieldNodes: FormFieldNode[],
  answers: Record<string, unknown>,
  formTitle: string,
): string {
  const parts: string[] = [];
  for (const n of fieldNodes) {
    if (
      n.type === "heading" ||
      n.type === "instructions" ||
      n.type === "section" ||
      n.type === "image"
    ) {
      continue;
    }
    const v = answers[n.id];
    if (v === undefined || v === null || v === "") continue;
    const text = Array.isArray(v)
      ? v.join(", ")
      : typeof v === "object" && v && "name" in v
        ? String((v as { name: string }).name)
        : String(v);
    if (text.trim()) {
      parts.push(`${n.label}: ${text.trim()}`);
    }
  }
  const summary = parts.join(" | ").slice(0, 1800);
  return summary || `Submitted via "${formTitle}"`;
}

export default function FillFormPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<FormRow | null>(null);
  const [nodes, setNodes] = useState<FormFieldNode[]>([]);
  const [theme, setTheme] = useState<FormTheme>({});
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [draftId, setDraftId] = useState<string | null>(null);
  const startMsRef = useRef<number>(0);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    startMsRef.current = Date.now();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const formId = params.get("id") ?? "";
    const existingDraft = params.get("draft");
    let active = true;
    (async () => {
      if (!formId) {
        if (active) setLoading(false);
        return;
      }
      try {
        const supabase = getSupabase();
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;

        const [{ data: profRow }, { data: fRow, error: fErr }] = await Promise.all([
          uid
            ? supabase.from("profiles").select("*").eq("id", uid).maybeSingle()
            : Promise.resolve({ data: null }),
          supabase.from("forms").select("*").eq("id", formId).maybeSingle(),
        ]);

        if (fErr) throw fErr;
        if (!fRow) {
          if (active) setError("Form not found or your email is not on this form's allowlist.");
          return;
        }
        const userProf = (profRow as UserProfile | null) ?? null;
        if (active) setProfile(userProf);

        const typedForm = fRow as FormRow;
        if (active) setForm(typedForm);

        const verNum = typedForm.current_published_version ?? typedForm.latest_version;
        const { data: verRow } = await supabase
          .from("form_versions")
          .select("*")
          .eq("form_id", typedForm.id)
          .eq("version_number", verNum)
          .maybeSingle();

        if (!active) return;
        const parsedNodes =
          ((verRow as { schema_json: FormFieldNode[] } | null)?.schema_json ?? []) as FormFieldNode[];
        const parsedTheme =
          ((verRow as { theme_json: FormTheme } | null)?.theme_json ?? {}) as FormTheme;

        setNodes(parsedNodes);
        setTheme(parsedTheme);

        const initialDefaults = buildDefaultAnswers(parsedNodes, userProf?.email);

        if (existingDraft) {
          const { data: dRow } = await supabase
            .from("submissions")
            .select("*")
            .eq("id", existingDraft)
            .maybeSingle();
          if (active && dRow) {
            setDraftId(existingDraft);
            const savedAnswers =
              ((dRow as { answers_json: Record<string, unknown> }).answers_json ??
                {}) as Record<string, unknown>;
            setAnswers({ ...initialDefaults, ...savedAnswers });
          } else {
            setAnswers(initialDefaults);
          }
        } else {
          setAnswers(initialDefaults);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load form.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleSaveOrSubmit(asDraft: boolean) {
    if (!form) return;
    if (theme.submissionsClosed) {
      setError("Submissions are currently paused / closed by the administrator.");
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const supabase = getSupabase();
      const duration = Math.floor((Date.now() - startMsRef.current) / 1000);
      const { data, error: rpcErr } = await supabase.rpc("submit_form_response", {
        p_form_id: form.id,
        p_answers: answers,
        p_service_id: null,
        p_duration_seconds: duration,
        p_as_draft: asDraft,
        p_submission_id: draftId,
      });
      if (rpcErr) throw rpcErr;
      const res = data as { submission_id: string; status: string };
      const submissionId = res.submission_id;

      const fileNodes = nodes.filter((n) => n.type === "file_upload");
      for (const node of fileNodes) {
        const file = pendingFiles[node.id];
        if (file) {
          try {
            const { data: sessData, error: sessErr } = await supabase.rpc(
              "create_file_upload_session",
              {
                p_submission_id: submissionId,
                p_file_name: file.name,
                p_mime_type: file.type || "application/octet-stream",
                p_size_bytes: file.size,
              },
            );
            if (!sessErr && sessData) {
              const fileId = (sessData as { file: { file_id: string } }).file?.file_id;
              if (fileId) {
                await supabase.rpc("finalize_file_upload", {
                  p_file_id: fileId,
                  p_drive_file_id: `pending_${Date.now()}`,
                  p_drive_web_view_link: "",
                });
              }
            }
          } catch (fileErr) {
            console.warn("Attachment session warning:", fileErr);
          }
        }
      }

      if (asDraft) {
        setDraftId(submissionId);
        setInfo("Draft saved.");
      } else {
        const cat = resolveFormCategory(form, theme);
        if (cat === "staff_complaints" || form.kind === "complaint") {
          try {
            const { data: tData } = await supabase.rpc("create_ticket", {
              p_form_id: form.id,
              p_submission_id: submissionId,
              p_kind: form.kind === "appeal_enabled" ? "appeal" : "complaint",
              p_reason: summarizeSubmissionReason(nodes, answers, form.title),
            });
            if (tData && (tData as { ticket_id?: string }).ticket_id) {
              setCreatedTicketId((tData as { ticket_id: string }).ticket_id);
            }
          } catch (ticketErr) {
            console.warn("Ticket auto-link warning:", ticketErr);
          }
        }
        setSubmittedId(submissionId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <ChunkLoader title="Loading Form..." subtitle="Preparing form fields..." />;
  }

  if (!form) {
    return (
      <section className="card stack">
        <h1>Form Unavailable</h1>
        <p className="notice">
          {error ?? "This form is either not published or restricted by an email allowlist."}
        </p>
        <div className="row-actions">
          <Link href="/" className="pixel-paper-btn primary">
            Return Home
          </Link>
        </div>
      </section>
    );
  }

  const category = resolveFormCategory(form, theme);
  const backHref =
    category === "voting_evaluation"
      ? "/voting/"
      : category === "staff_complaints"
        ? "/tickets/"
        : "/forms/";
  const backLabel =
    category === "voting_evaluation"
      ? "Voting & Evaluation"
      : category === "staff_complaints"
        ? "Staff Complaints"
        : "Company Forms";
  const primaryAccent = theme.primaryColor || "#1d4ed8";

  if (submittedId) {
    return (
      <div className="app-success-card" style={{ borderTop: `8px solid ${primaryAccent}` }}>
        <div className="app-success-icon" aria-hidden="true">
          <PixelCheckIcon size={28} />
        </div>
        <h2 style={{ fontSize: "1.35rem", fontWeight: 800, margin: "0.2rem 0" }}>
          {category === "voting_evaluation"
            ? "Score & Vote Submitted!"
            : category === "staff_complaints"
              ? "Complaint Logged & Tracked!"
              : "Form Submitted!"}
        </h2>
        <p className="notice" style={{ maxWidth: "42ch", margin: "0 auto" }}>
          Recorded under <strong>{profile?.email ?? "your account"}</strong>.
        </p>

        <div className="app-success-actions">
          {createdTicketId ? (
            <Link
              href={`/tickets/ticket-id/?id=${encodeURIComponent(createdTicketId)}`}
              className="pixel-paper-btn primary"
              style={{ width: "100%", justifyContent: "center", backgroundColor: primaryAccent }}
            >
              <PixelShieldAlertIcon size={15} />
              <span>Track Live Complaint Status</span>
              <PixelArrowRightIcon size={14} />
            </Link>
          ) : category === "staff_complaints" ? (
            <Link
              href="/tickets/"
              className="pixel-paper-btn primary"
              style={{ width: "100%", justifyContent: "center", backgroundColor: primaryAccent }}
            >
              <PixelShieldAlertIcon size={15} />
              <span>Track Complaint Status</span>
            </Link>
          ) : null}

          <Link
            href={backHref}
            className={`pixel-paper-btn ${!createdTicketId && category !== "staff_complaints" ? "primary" : ""}`}
            style={{ width: "100%", justifyContent: "center" }}
          >
            <span>Back to {backLabel}</span>
          </Link>

          <Link href="/" className="pixel-paper-btn" style={{ width: "100%", justifyContent: "center" }}>
            <span>Main Menu</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fill-themed-stage"
      style={{
        backgroundColor: theme.backgroundColor || "transparent",
        backgroundImage: getFormBackgroundPatternCss(theme.backgroundPattern),
        backgroundSize: getFormBackgroundPatternSize(theme.backgroundPattern),
      }}
    >
      {theme.backgroundImageUrl && (
        <div
          className="gf-bg-photo-layer fixed"
          style={{
            backgroundImage: `url(${theme.backgroundImageUrl})`,
            filter: theme.backgroundBlur ? `blur(${theme.backgroundBlur}px)` : undefined,
          }}
        >
          <div
            className="gf-bg-photo-overlay"
            style={{
              backgroundColor: theme.backgroundColor || "#efece6",
              opacity: (theme.backgroundOverlayOpacity ?? 35) / 100,
            }}
          />
        </div>
      )}

      <div className="fill-form-column">
        {/* Clean Native-App Top Bar */}
        <div className="fill-top-nav">
          <Link href={backHref} className="pixel-paper-btn compact">
            <PixelArrowLeftIcon size={12} />
            <span>{backLabel}</span>
          </Link>

          {profile && (
            <span className="fill-account-pill" title={`Submitting as ${profile.email}`}>
              <PixelLockIcon size={11} />
              <span>{profile.email}</span>
            </span>
          )}
        </div>

        {/* Unified Form Header Card (Banner + Accent Strip + Title) */}
        <section className="fill-header-card">
          {theme.bannerImageUrl && (
            <div className={`fill-header-banner height-${theme.bannerHeight ?? "medium"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={theme.bannerImageUrl} alt={form.title} className="gf-banner-img" />
            </div>
          )}

          <div
            className="fill-header-body"
            style={{ borderTop: `6px solid ${primaryAccent}` }}
          >
            <h1 className="fill-form-title">{form.title}</h1>
            {form.description && (
              <p className="fill-form-desc">{form.description}</p>
            )}
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

        {theme.submissionsClosed ? (
          <section className="gf-closed-lock-card">
            <PixelPauseIcon size={28} />
            <h2 style={{ margin: "0.25rem 0" }}>Form Closed</h2>
            <p className="notice" style={{ maxWidth: "46ch", margin: "0 auto" }}>
              {theme.closedReason ||
                "This form is currently paused by the administrator and is not accepting new responses."}
            </p>
            <Link href={backHref} className="pixel-paper-btn primary" style={{ marginTop: "0.5rem" }}>
              <PixelArrowLeftIcon size={14} />
              <span>Return to {backLabel}</span>
            </Link>
          </section>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSaveOrSubmit(false);
            }}
            className="fr-questions-stack"
          >
            <FormRenderer
              nodes={nodes}
              theme={theme}
              answers={answers}
              onChange={(fid, val, file) => {
                setAnswers((prev) => ({ ...prev, [fid]: val }));
                setPendingFiles((prev) => {
                  const next = { ...prev };
                  if (file) next[fid] = file;
                  else delete next[fid];
                  return next;
                });
              }}
              disabled={busy}
            />

            <div className="fr-submit-bar">
              <button
                type="submit"
                className="pixel-paper-btn primary fr-submit-primary"
                style={{ backgroundColor: primaryAccent }}
                disabled={busy}
              >
                <span>{busy ? "Submitting..." : "Submit Form"}</span>
                <PixelArrowRightIcon size={14} />
              </button>
              {form.allow_save_draft && (
                <button
                  type="button"
                  className="pixel-paper-btn fr-submit-secondary"
                  disabled={busy}
                  onClick={() => void handleSaveOrSubmit(true)}
                >
                  <PixelSaveIcon size={14} />
                  <span>Save Draft</span>
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
