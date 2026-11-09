"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import ChunkLoader from "@/components/ChunkLoader";
import { getSupabase, type SystemSetupState, type UserProfile } from "@/lib/supabase";

interface DashboardStats {
  formsCount: number;
  submissionsCount: number;
  ticketsCount: number;
  usersCount: number;
}

export default function HomePage() {
  const [setupState, setSetupState] = useState<SystemSetupState | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    formsCount: 0,
    submissionsCount: 0,
    ticketsCount: 0,
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

          // Fetch dashboard summary counts
          const [fRes, subRes, tRes, uRes] = await Promise.allSettled([
            supabase.from("forms").select("id", { count: "exact", head: true }),
            supabase.from("submissions").select("id", { count: "exact", head: true }),
            supabase.from("tickets").select("id", { count: "exact", head: true }),
            supabase.from("profiles").select("id", { count: "exact", head: true }),
          ]);

          setStats({
            formsCount: fRes.status === "fulfilled" ? fRes.value.count ?? 0 : 0,
            submissionsCount: subRes.status === "fulfilled" ? subRes.value.count ?? 0 : 0,
            ticketsCount: tRes.status === "fulfilled" ? tRes.value.count ?? 0 : 0,
            usersCount: uRes.status === "fulfilled" ? uRes.value.count ?? 0 : 0,
          });
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
        <ChunkLoader
          title="Loading Forms MESRC..."
          subtitle="Checking workspace status"
        />
      </div>
    );
  }

  // 1. Initial Setup Required
  if (setupState?.needs_first_maintenance) {
    return (
      <div className="center-stage">
        <section className="card stack">
          <div className="row-between">
            <BrandLogo size="lg" subtitle="Invite-Only Workspace" />
            <span className="badge">Initial Setup Required</span>
          </div>
          <h1>Welcome to Forms MESRC</h1>
          <p className="notice">
            This system has not been initialized yet. Before anyone can sign in, complete the
            first-time setup wizard to register the initial Maintenance account via email OTP and
            configure company Google Workspace Shared Drive storage.
          </p>
          <div className="row-actions">
            <Link href="/setup/" className="btn btn-primary">
              Start First-Time Setup Wizard
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
          <BrandLogo size="lg" subtitle="Invite-Only Workspace" />
          <h1>Welcome to Forms MESRC</h1>
          <p className="notice">
            Internal corporate workspace for company forms, appeals, and operational complaint tickets. Access is strictly by invitation only via one-time email passcode.
          </p>
          <div className="row-actions">
            <Link href="/sign-in/" className="btn btn-primary">
              Sign in with Email OTP
            </Link>
          </div>
        </section>
      </div>
    );
  }

  // 3. Authenticated: Full Rich Operational Dashboard
  const isStaff = profile.role === "admin" || profile.role === "maintenance";

  return (
    <div className="stack">
      {/* Welcome Banner */}
      <section className="card row-between" style={{ alignItems: "flex-start" }}>
        <div>
          <span className="badge" style={{ marginBottom: "0.5rem" }}>
            Operational Dashboard
          </span>
          <h1>Welcome, {profile.email}</h1>
          <p className="notice">
            You are signed in with the authority of <strong>{profile.role.toUpperCase()}</strong>. Here is your system activity overview.
          </p>
        </div>
        <div className="row-actions">
          <Link href="/forms/" className="btn btn-primary">
            + Fill a Form
          </Link>
          <Link href="/tickets/" className="btn btn-secondary">
            + File Ticket
          </Link>
        </div>
      </section>

      {/* 4 Metrics Cards */}
      <div className="grid-4">
        <Link href="/forms/" className="stat-card-link">
          <div className="card stat-card">
            <span className="stat-label">Available Forms</span>
            <strong className="stat-value">{stats.formsCount}</strong>
            <span className="notice" style={{ fontSize: "0.78rem" }}>Browse catalog &rarr;</span>
          </div>
        </Link>

        <Link href={isStaff ? "/admin/" : "/forms/"} className="stat-card-link">
          <div className="card stat-card">
            <span className="stat-label">Submissions</span>
            <strong className="stat-value">{stats.submissionsCount}</strong>
            <span className="notice" style={{ fontSize: "0.78rem" }}>
              {isStaff ? "Review responses &rarr;" : "View submitted &rarr;"}
            </span>
          </div>
        </Link>

        <Link href="/tickets/" className="stat-card-link">
          <div className="card stat-card">
            <span className="stat-label">Appeals &amp; Tickets</span>
            <strong className="stat-value">{stats.ticketsCount}</strong>
            <span className="notice" style={{ fontSize: "0.78rem" }}>Support desk &rarr;</span>
          </div>
        </Link>

        {isStaff ? (
          <Link href="/users/" className="stat-card-link">
            <div className="card stat-card">
              <span className="stat-label">Team Members</span>
              <strong className="stat-value">{stats.usersCount}</strong>
              <span className="notice" style={{ fontSize: "0.78rem" }}>Directory &amp; Invites &rarr;</span>
            </div>
          </Link>
        ) : (
          <div className="card stat-card">
            <span className="stat-label">Your Role</span>
            <strong className="stat-value" style={{ fontSize: "1.4rem" }}>User</strong>
            <span className="notice" style={{ fontSize: "0.78rem" }}>Standard Access</span>
          </div>
        )}
      </div>

      {/* Fast Access Grid */}
      <section className="card stack">
        <h2>Quick Shortcuts</h2>
        <div className="grid-3">
          <Link href="/forms/" className="shortcut-box">
            <strong>📋 Company Forms</strong>
            <p className="notice" style={{ fontSize: "0.84rem" }}>
              Browse all published forms, fill inquiries, upload documents, and track status.
            </p>
          </Link>

          <Link href="/tickets/" className="shortcut-box">
            <strong>🎫 Appeals &amp; Helpdesk</strong>
            <p className="notice" style={{ fontSize: "0.84rem" }}>
              Submit an operational complaint or appeal, receive updates, and collaborate with staff.
            </p>
          </Link>

          {isStaff && (
            <Link href="/admin/" className="shortcut-box">
              <strong>📥 Submissions Review</strong>
              <p className="notice" style={{ fontSize: "0.84rem" }}>
                Inspect form answers, download verified Google Drive attachments, and review requesters.
              </p>
            </Link>
          )}

          {isStaff && (
            <Link href="/users/" className="shortcut-box">
              <strong>👥 Users &amp; Invites</strong>
              <p className="notice" style={{ fontSize: "0.84rem" }}>
                View registered members, activate or suspend accounts, and generate email invitations.
              </p>
            </Link>
          )}

          {isStaff && (
            <Link href="/admin/forms/" className="shortcut-box">
              <strong>🛠️ Form Builder</strong>
              <p className="notice" style={{ fontSize: "0.84rem" }}>
                Create, customize, and publish new dynamic corporate form schemas.
              </p>
            </Link>
          )}

          {profile.role === "maintenance" && (
            <Link href="/maintenance/settings/" className="shortcut-box">
              <strong>⚙️ Storage &amp; Integrations</strong>
              <p className="notice" style={{ fontSize: "0.84rem" }}>
                Manage company Google Workspace Shared Drive credentials and email configuration.
              </p>
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
