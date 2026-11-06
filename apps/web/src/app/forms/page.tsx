"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormRow, ServiceRow } from "@/lib/form-types";
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
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [formServiceMap, setFormServiceMap] = useState<Record<string, string[]>>({});
  const [mySubmissions, setMySubmissions] = useState<SubmissionRow[]>([]);
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
        setProfile((prof as UserProfile | null) ?? null);
        setForms((fRows as FormRow[] | null) ?? []);
        setServices((sRows as ServiceRow[] | null) ?? []);
        setMySubmissions((subRows as SubmissionRow[] | null) ?? []);

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
      <section className="card">
        <h1>Available Forms</h1>
        <p className="notice">Loading forms...</p>
      </section>
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
          <Link href="/sign-in/" className="btn btn-primary">
            Sign in with Email OTP
          </Link>
        </div>
      </section>
    );
  }

  const filteredForms =
    serviceFilter === "all"
      ? forms
      : forms.filter((f) => (formServiceMap[f.id] ?? []).includes(serviceFilter));

  const formTitleById = Object.fromEntries(forms.map((f) => [f.id, f.title]));

  return (
    <div className="stack">
      <section className="card row-between">
        <div>
          <h1>Available Company Forms</h1>
          <p className="notice">
            All published forms open to your account ({profile.email}). Optimized for mobile and
            desktop completion.
          </p>
        </div>
        <div className="field" style={{ minWidth: "220px" }}>
          <label htmlFor="cat-svc">Filter by Service</label>
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
      </section>

      {filteredForms.length === 0 ? (
        <section className="card">
          <p className="notice">No published forms match the selected filter.</p>
        </section>
      ) : (
        <div className="grid-2">
          {filteredForms.map((f) => (
            <section key={f.id} className="card stack" style={{ margin: 0 }}>
              <div className="row-between">
                <strong>{f.title}</strong>
                <span className="badge badge-configured">{f.kind.replace("_", " ")}</span>
              </div>
              {f.description && <p className="notice">{f.description}</p>}
              <div className="row-actions">
                <Link
                  href={`/forms/fill/?id=${encodeURIComponent(f.id)}`}
                  className="btn btn-primary"
                >
                  Open &amp; Fill Form
                </Link>
              </div>
            </section>
          ))}
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
                        className={`badge ${sub.status === "submitted" ? "badge-configured" : "badge-not_configured"}`}
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td>{sub.duration_seconds != null ? `${sub.duration_seconds}s` : "—"}</td>
                    <td>
                      {new Date(sub.submitted_at ?? sub.created_at).toLocaleString()}
                    </td>
                    <td>
                      {sub.status === "draft" && (
                        <Link
                          href={`/forms/fill/?id=${encodeURIComponent(sub.form_id)}&draft=${encodeURIComponent(sub.id)}`}
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