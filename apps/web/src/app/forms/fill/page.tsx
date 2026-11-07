"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ChunkLoader from "@/components/ChunkLoader";
import FormRenderer from "@/components/FormRenderer";
import type { FormFieldNode, FormRow, FormTheme, ServiceRow } from "@/lib/form-types";
import { getSupabase } from "@/lib/supabase";

export default function FillFormPage() {
  const [form, setForm] = useState<FormRow | null>(null);
  const [nodes, setNodes] = useState<FormFieldNode[]>([]);
  const [theme, setTheme] = useState<FormTheme>({});
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [serviceId, setServiceId] = useState<string>("");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [draftId, setDraftId] = useState<string | null>(null);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startMsRef = useRef<number>(0);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{
    id: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    drive_file_id: string;
    drive_web_view_link: string;
    created_at: string;
  }>>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    startMsRef.current = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startMsRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
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
        const { data: fRow, error: fErr } = await supabase
          .from("forms")
          .select("*")
          .eq("id", formId)
          .maybeSingle();
        if (fErr) throw fErr;
        if (!fRow) {
          if (active) setError("Form not found or your email is not on this form's allowlist.");
          return;
        }
        const typedForm = fRow as FormRow;
        if (active) setForm(typedForm);

        const verNum = typedForm.current_published_version ?? typedForm.latest_version;
        const [{ data: verRow }, { data: sRows }] = await Promise.all([
          supabase
            .from("form_versions")
            .select("*")
            .eq("form_id", typedForm.id)
            .eq("version_number", verNum)
            .maybeSingle(),
          supabase
            .from("services")
            .select("*")
            .eq("is_active", true)
            .order("sort_order", { ascending: true }),
        ]);

        if (!active) return;
        if (verRow) {
          setNodes(((verRow as { schema_json: FormFieldNode[] }).schema_json ?? []) as FormFieldNode[]);
          setTheme(((verRow as { theme_json: FormTheme }).theme_json ?? {}) as FormTheme);
        }
        setServices((sRows as ServiceRow[] | null) ?? []);

        if (existingDraft) {
          const { data: dRow } = await supabase
            .from("submissions")
            .select("*")
            .eq("id", existingDraft)
            .maybeSingle();
          if (active && dRow) {
            setDraftId(existingDraft);
            setAnswers(((dRow as { answers_json: Record<string, unknown> }).answers_json ?? {}) as Record<string, unknown>);
          }
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
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const supabase = getSupabase();
      const duration = Math.floor((Date.now() - startMsRef.current) / 1000);
      const { data, error: rpcErr } = await supabase.rpc("submit_form_response", {
        p_form_id: form.id,
        p_answers: answers,
        p_service_id: serviceId || null,
        p_duration_seconds: duration,
        p_as_draft: asDraft,
        p_submission_id: draftId,
      });
      if (rpcErr) throw rpcErr;
      const res = data as { submission_id: string; status: string };
      const submissionId = res.submission_id;

      // Do not record metadata as if file bytes had been uploaded to Drive.
      const fileNodes = nodes.filter((n) => n.type === "file_upload");
      for (const node of fileNodes) {
        if (pendingFiles[node.id]) {
          throw new Error("File uploads are unavailable until Google Drive upload is configured. Remove the selected file and submit again.");
        }
      }

      if (asDraft) {
        setDraftId(submissionId);
        setInfo("Draft saved. You can resume it anytime from the Forms page.");
      } else {
        setSubmittedId(submissionId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadFile(fileId: string) {
    setFileError(null);
    try {
      const supabase = getSupabase();
      const { data, error: dlErr } = await supabase.rpc("get_file_download_url", {
        p_file_id: fileId,
      });
      if (dlErr) throw dlErr;
      const res = data as { drive_web_view_link: string; file_name: string };
      if (res.drive_web_view_link) {
        window.open(res.drive_web_view_link, "_blank");
      } else {
        setFileError("No download link available.");
      }
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Download failed.");
    }
  }

  async function handleDeleteFile(fileId: string) {
    setFileError(null);
    try {
      const supabase = getSupabase();
      const { error: delErr } = await supabase.rpc("delete_submission_file", {
        p_file_id: fileId,
      });
      if (delErr) throw delErr;
      setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
      setInfo("File deleted.");
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  if (loading) {
    return (
      <ChunkLoader
        title="Loading Form..."
        subtitle="Preparing form fields"
      />
    );
  }

  if (!form) {
    return (
      <section className="card stack">
        <h1>Form Unavailable</h1>
        <p className="notice">
          {error ?? "This form is either not published or restricted by an email allowlist."}
        </p>
        <div className="row-actions">
          <Link href="/forms/" className="btn btn-primary">
            Back to Forms Catalog
          </Link>
        </div>
      </section>
    );
  }

  if (submittedId) {
    return (
      <section className="card stack">
        <h1>Submission Received</h1>
        <p className="alert alert-ok">
          Your response for <strong>{form.title}</strong> (v{form.current_published_version}) has
          been recorded. Reference ID: <code>{submittedId}</code>.
        </p>
        <div className="row-actions">
          <Link href="/forms/" className="btn btn-primary">
            Return to Forms Catalog
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="card stack">
      <div className="row-between">
        <div>
          <h1>{form.title}</h1>
          {form.description && <p className="notice">{form.description}</p>}
        </div>
        <span className="badge badge-not_configured">
          Timer: {Math.floor(elapsedSeconds / 60)}m {elapsedSeconds % 60}s
        </span>
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

      {services.length > 0 && (
        <div className="field">
          <label htmlFor="fill-svc">Related Company Service / Operation (Optional)</label>
          <select
            id="fill-svc"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
          >
            <option value="">General / Not specified</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSaveOrSubmit(false);
        }}
        className="stack"
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

        {uploadedFiles.length > 0 && (
          <section className="card stack" style={{ marginTop: "1rem" }}>
            <h2>Attached Files</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadedFiles.map((f) => (
                    <tr key={f.id}>
                      <td>{f.file_name}</td>
                      <td>{f.mime_type}</td>
                      <td>{(f.size_bytes / 1024 / 1024).toFixed(2)} MB</td>
                      <td>
                        <div className="row-actions" style={{ gap: "0.5rem" }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={busy}
                            onClick={() => handleDownloadFile(f.id)}
                          >
                            Download
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={busy}
                            onClick={() => handleDeleteFile(f.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {fileError && (
              <p className="alert alert-error" role="alert">{fileError}</p>
            )}
          </section>
        )}

        <div className="row-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Submitting..." : "Submit Form"}
          </button>
          {form.allow_save_draft && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => handleSaveOrSubmit(true)}
            >
              Save Draft
            </button>
          )}
          <Link href="/forms/" className="btn btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
