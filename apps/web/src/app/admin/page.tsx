"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import InvitationManager from "@/components/InvitationManager";
import ServiceManager from "@/components/ServiceManager";
import type { FormRow } from "@/lib/form-types";
import { getSupabase, type UserProfile } from "@/lib/supabase";

interface AdminSubmissionRow {
  id: string;
  form_id: string;
  form_version: number;
  user_id: string;
  status: string;
  answers_json: Record<string, unknown>;
  duration_seconds: number | null;
  submitted_at: string | null;
  created_at: string;
}

export default function AdminPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [submissions, setSubmissions] = useState<AdminSubmissionRow[]>([]);
  const [formsMap, setFormsMap] = useState<Record<string, FormRow>>({});
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [selectedSub, setSelectedSub] = useState<AdminSubmissionRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        if (!uid) return;
        const [{ data: prof }, { data: subRows }, { data: fRows }, { data: uRows }] =
          await Promise.all([
            supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
            supabase
              .from("submissions")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(100),
            supabase.from("forms").select("*"),
            supabase.from("profiles").select("id,email"),
          ]);
        if (!active) return;
        setProfile((prof as UserProfile | null) ?? null);
        setSubmissions((subRows as AdminSubmissionRow[] | null) ?? []);
        setFormsMap(
          Object.fromEntries(((fRows as FormRow[] | null) ?? []).map((f) => [f.id, f])),
        );
        setUsersMap(
          Object.fromEntries(
            ((uRows as { id: string; email: string }[] | null) ?? []).map((u) => [u.id, u.email]),
          ),
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
      <section className="card">
        <h1>Admin Workspace</h1>
        <p className="notice">Loading...</p>
      </section>
    );
  }

  if (!profile || (profile.role !== "admin" && profile.role !== "maintenance")) {
    return (
      <section className="card stack">
        <h1>Access Denied</h1>
        <p className="notice">Only Admin or Maintenance accounts may access this workspace.</p>
        <div className="row-actions">
          <Link href="/sign-in/" className="btn btn-primary">
            Sign in
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="stack">
      <section className="card row-between">
        <div>
          <h1>Admin Workspace</h1>
          <p className="notice">
            Build versioned forms, manage company services, review submissions, and invite Users.
          </p>
        </div>
        <div className="row-actions">
          <Link href="/admin/forms/" className="btn btn-primary">
            Open Visual Form Builder
          </Link>
        </div>
      </section>

      <section className="card stack">
        <h2>Company Submissions ({submissions.length})</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Form</th>
                <th>Requester</th>
                <th>Version</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Date</th>
                <th>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {submissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="notice">
                    No submissions yet.
                  </td>
                </tr>
              ) : (
                submissions.map((sub) => (
                  <tr key={sub.id}>
                    <td>{formsMap[sub.form_id]?.title ?? sub.form_id.slice(0, 8)}</td>
                    <td>{usersMap[sub.user_id] ?? sub.user_id.slice(0, 8)}</td>
                    <td>v{sub.form_version}</td>
                    <td>
                      <span
                        className={`badge ${sub.status === "submitted" ? "badge-configured" : "badge-not_configured"}`}
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td>{sub.duration_seconds != null ? `${sub.duration_seconds}s` : "—"}</td>
                    <td>{new Date(sub.submitted_at ?? sub.created_at).toLocaleString()}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => setSelectedSub(sub)}
                      >
                        View Answers
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {selectedSub && (
          <div className="card stack" style={{ margin: 0, background: "#f8fafc" }}>
            <div className="row-between">
              <strong>
                Submission Detail ({formsMap[selectedSub.form_id]?.title ?? "Form"} v
                {selectedSub.form_version})
              </strong>
              <button
                type="button"
                className="btn-link"
                onClick={() => setSelectedSub(null)}
              >
                Close
              </button>
            </div>
            <pre style={{ margin: 0, overflowX: "auto", fontSize: "0.85rem" }}>
              {JSON.stringify(selectedSub.answers_json, null, 2)}
            </pre>
          </div>
        )}
      </section>

      <section className="card">
        <ServiceManager />
      </section>

      <section className="card">
        <InvitationManager callerRole={profile.role} />
      </section>
    </div>
  );
}