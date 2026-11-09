"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import ChunkLoader from "@/components/ChunkLoader";
import type { FormRow } from "@/lib/form-types";
import { getSupabase, type SystemSetupState, type UserProfile } from "@/lib/supabase";

interface RecentTicketPreview {
  id: string;
  kind: "appeal" | "complaint";
  status: string;
  reason: string;
  created_at: string;
}

interface StaffMetrics {
  submissionsCount: number;
  usersCount: number;
}

export default function HomePage() {
  const [setupState, setSetupState] = useState<SystemSetupState | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [publishedForms, setPublishedForms] = useState<FormRow[]>([]);
  const [recentTickets, setRecentTickets] = useState<RecentTicketPreview[]>([]);
  const [staffMetrics, setStaffMetrics] = useState<StaffMetrics>({
    submissionsCount: 0,
    usersCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const supabase = getSupabase();
        const [{ data: st }, { data: sess }] = await Promise.all([
          supabase.rpc("get_system_setup_state"),
          supabase.auth.getSession(),
        ]);
        setSetupState((st as SystemSetupState | null) ?? null);
        const uid = sess.session?.user?.id;

        if (uid) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", uid)
            .maybeSingle();
          const typedProf = (prof as UserProfile | null) ?? null;
          setProfile(typedProf);

          if (typedProf) {
            const [formsRes, ticketsRes, subCountRes, userCountRes] = await Promise.allSettled([
              supabase
                .from("forms")
                .select("*")
                .eq("state", "published")
                .order("title", { ascending: true })
                .limit(4),
              supabase
                .from("tickets")
                .select("id,kind,status,reason,created_at")
                .order("created_at", { ascending: false })
                .limit(3),
              supabase.from("submissions").select("id", { count: "exact", head: true }),
              supabase.from("profiles").select("id", { count: "exact", head: true }),
            ]);

            if (formsRes.status === "fulfilled") {
              setPublishedForms((formsRes.value.data as FormRow[] | null) ?? []);
            }
            if (ticketsRes.status === "fulfilled") {
              setRecentTickets((ticketsRes.value.data as RecentTicketPreview[] | null) ?? []);
            }
            setStaffMetrics({
              submissionsCount:
                subCountRes.status === "fulfilled" ? subCountRes.value.count ?? 0 : 0,
              usersCount:
                userCountRes.status === "fulfilled" ? userCountRes.value.count ?? 0 : 0,
            });
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="center-stage">
        <ChunkLoader title="Forms MESRC" subtitle="Preparing workspace portal..." />
      </div>
    );
  }

  // 1. Initial Setup Required
  if (setupState?.needs_first_maintenance) {
    return (
      <div className="center-stage">
        <section className="card stack">
          <div className="row-between">
            <BrandLogo size="lg" subtitle="System Initialization" />
            <span className="badge badge-admin">Setup Required</span>
          </div>
          <h1>Initialize Forms MESRC</h1>
          <p className="notice">
            No Maintenance account has been configured yet. Complete the guided 3-step setup
            wizard to verify the first Maintenance email and connect your company Google Workspace
            Shared Drive.
          </p>
          <div className="row-actions">
            <Link href="/setup/" className="btn btn-primary">
              Launch First-Time Setup Wizard
            </Link>
          </div>
        </section>
      </div>
    );
  }

  // 2. Not signed in yet
  if (!profile) {
    return (
      <div className="center-stage">
        <section className="card stack">
          <BrandLogo size="lg" subtitle="Invite-Only Portal" />
          <h1>Company Forms &amp; Complaints Portal</h1>
          <p className="notice">
            Official workspace for submitting company forms, operational complaints, and appeals.
            Access is restricted to invited team members via one-time email verification.
          </p>
          <div className="row-actions">
            <Link href="/sign-in/" className="btn btn-accent">
              Sign in with Email Passcode
            </Link>
          </div>
        </section>
      </div>
    );
  }

  // 3. Signed-In Action Portal: Choose Forms vs Complaints/Appeals (Aduan)
  const isStaff = profile.role === "admin" || profile.role === "maintenance";

  return (
    <div className="stack">
      {/* Clean Workspace Greeting */}
      <div className="portal-hero-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", marginBottom: "0.35rem" }}>
            <span className="badge badge-configured">Active Session</span>
            <span className="badge">{profile.role.toUpperCase()}</span>
          </div>
          <h1 style={{ marginBottom: "0.2rem" }}>What would you like to do today?</h1>
          <p className="notice">
            Choose between filling out an official company form or submitting an operational complaint / appeal.
          </p>
        </div>
      </div>

      {/* Primary Dual-Choice Portal: 1. Forms  |  2. Complaints & Appeals (Aduan) */}
      <div className="portal-choice-grid">
        {/* CHOICE 1: COMPANY FORMS */}
        <section className="portal-card portal-card-forms">
          <div>
            <div className="portal-card-top">
              <div className="portal-icon-box portal-icon-forms" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <line x1="10" y1="9" x2="8" y2="9" />
                </svg>
              </div>
              <span className="badge badge-configured">
                {publishedForms.length} {publishedForms.length === 1 ? "Form" : "Forms"} Available
              </span>
            </div>

            <h2 className="portal-card-title">Company Forms</h2>
            <p className="portal-card-desc">
              Browse and complete official company forms, attach supporting files to Google Drive, and review your submitted applications.
            </p>

            <div className="portal-quick-list">
              <span className="portal-quick-list-label">Quick Launch Forms</span>
              {publishedForms.length === 0 ? (
                <div style={{ fontSize: "0.85rem", color: "var(--muted)", padding: "0.35rem 0.2rem" }}>
                  No forms have been published yet.
                  {isStaff && (
                    <>
                      {" "}
                      <Link href="/admin/forms/">Create your first form &rarr;</Link>
                    </>
                  )}
                </div>
              ) : (
                publishedForms.slice(0, 3).map((f) => (
                  <Link
                    key={f.id}
                    href={`/forms/fill/?id=${encodeURIComponent(f.id)}`}
                    className="portal-quick-item"
                  >
                    <span>{f.title}</span>
                    <span style={{ fontSize: "0.78rem", color: "var(--accent)" }}>Fill Form &rarr;</span>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="row-actions">
            <Link href="/forms/" className="btn btn-accent">
              Open Forms Directory
            </Link>
            {isStaff && (
              <Link href="/admin/forms/" className="btn btn-secondary">
                Form Builder
              </Link>
            )}
          </div>
        </section>

        {/* CHOICE 2: COMPLAINTS & APPEALS (ADUAN) */}
        <section className="portal-card portal-card-tickets">
          <div>
            <div className="portal-card-top">
              <div className="portal-icon-box portal-icon-tickets" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <span className="badge badge-admin">
                {recentTickets.length} Recent {recentTickets.length === 1 ? "Ticket" : "Tickets"}
              </span>
            </div>

            <h2 className="portal-card-title">Complaints &amp; Appeals</h2>
            <p className="portal-card-desc">
              Submit an operational complaint or lodge a formal appeal regarding a form submission, and communicate directly with the support team.
            </p>

            <div className="portal-quick-list">
              <span className="portal-quick-list-label"> Direct Actions &amp; Recent Activity</span>
              <Link href="/tickets/?new=1&kind=complaint" className="portal-quick-item">
                <span>Submit Operational Complaint</span>
                <span style={{ fontSize: "0.78rem", color: "var(--amber)" }}>New Complaint &rarr;</span>
              </Link>
              <Link href="/tickets/?new=1&kind=appeal" className="portal-quick-item">
                <span>Submit Application Appeal</span>
                <span style={{ fontSize: "0.78rem", color: "var(--amber)" }}>New Appeal &rarr;</span>
              </Link>
              {recentTickets.slice(0, 1).map((t) => (
                <Link
                  key={t.id}
                  href={`/tickets/${encodeURIComponent(t.id)}`}
                  className="portal-quick-item"
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    [{t.kind.toUpperCase()}] {t.reason}
                  </span>
                  <span className="badge" style={{ fontSize: "0.7rem", padding: "0.1rem 0.45rem" }}>
                    {t.status}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="row-actions">
            <Link href="/tickets/?new=1" className="btn btn-primary">
              + Lodge Complaint or Appeal
            </Link>
            <Link href="/tickets/" className="btn btn-secondary">
              View All Tickets
            </Link>
          </div>
        </section>
      </div>

      {/* Compact Staff Management Strip (Visible Only to Admin & Maintenance) */}
      {isStaff && (
        <section className="card stack" style={{ padding: "1.35rem 1.5rem" }}>
          <div className="row-between">
            <div>
              <h2 style={{ marginBottom: "0.15rem", fontSize: "1.05rem" }}>Management Overview</h2>
              <p className="notice" style={{ fontSize: "0.85rem" }}>
                Quick administrative access to submissions, team accounts, and system configuration.
              </p>
            </div>
          </div>

          <div className="grid-4">
            <Link href="/admin/" className="stat-card-link">
              <div className="stat-card">
                <span className="stat-label">Form Submissions</span>
                <strong className="stat-value">{staffMetrics.submissionsCount}</strong>
                <span className="notice" style={{ fontSize: "0.78rem" }}>Review answers &rarr;</span>
              </div>
            </Link>

            <Link href="/users/" className="stat-card-link">
              <div className="stat-card">
                <span className="stat-label">Team &amp; Invites</span>
                <strong className="stat-value">{staffMetrics.usersCount}</strong>
                <span className="notice" style={{ fontSize: "0.78rem" }}>Manage users &rarr;</span>
              </div>
            </Link>

            <Link href="/admin/forms/" className="stat-card-link">
              <div className="stat-card">
                <span className="stat-label">Published Forms</span>
                <strong className="stat-value">{publishedForms.length}</strong>
                <span className="notice" style={{ fontSize: "0.78rem" }}>Visual builder &rarr;</span>
              </div>
            </Link>

            {profile.role === "maintenance" ? (
              <Link href="/maintenance/settings/" className="stat-card-link">
                <div className="stat-card">
                  <span className="stat-label">Google Drive</span>
                  <strong className="stat-value" style={{ fontSize: "1.2rem" }}>
                    {setupState?.setup_wizard_completed ? "Active" : "Configure"}
                  </strong>
                  <span className="notice" style={{ fontSize: "0.78rem" }}>Storage settings &rarr;</span>
                </div>
              </Link>
            ) : (
              <Link href="/tickets/" className="stat-card-link">
                <div className="stat-card">
                  <span className="stat-label">Support Queue</span>
                  <strong className="stat-value">{recentTickets.length}</strong>
                  <span className="notice" style={{ fontSize: "0.78rem" }}>Handle tickets &rarr;</span>
                </div>
              </Link>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
