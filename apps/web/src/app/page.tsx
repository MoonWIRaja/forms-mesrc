"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import ChunkLoader from "@/components/ChunkLoader";
import { getSupabase, type SystemSetupState, type UserProfile } from "@/lib/supabase";

export default function HomePage() {
  const [setupState, setSetupState] = useState<SystemSetupState | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
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
          setProfile((prof as UserProfile | null) ?? null);
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) {
    return (
      <div className="center-stage">
        <ChunkLoader title="Forms MESRC" subtitle="Assembling workspace..." />
      </div>
    );
  }

  async function handleSignOut() {
    await getSupabase().auth.signOut();
    setProfile(null);
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
          <h1>First-Time System Setup</h1>
          <p className="notice">
            Complete the guided 3-step setup wizard to verify the first Maintenance email and
            connect your company Google Workspace Shared Drive.
          </p>
          <div className="row-actions">
            <Link href="/setup/" className="btn btn-primary">
              Launch Setup Wizard &rarr;
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
        <section className="card stack" style={{ textAlign: "center", alignItems: "center" }}>
          <BrandLogo size="lg" subtitle="Invite-Only Workspace" />
          <h1 style={{ fontSize: "1.25rem", margin: "0.55rem 0 0.2rem", fontWeight: 700 }}>
            Sign in to get started
          </h1>
          <p className="notice" style={{ maxWidth: "38ch", margin: "0.25rem 0 0.5rem" }}>
            Company portal for official forms, complaints, and appeals. Sign in with your invited
            email to continue.
          </p>
          <div className="row-actions" style={{ justifyContent: "center", width: "100%", marginTop: "0.5rem" }}>
            <Link href="/sign-in/" className="btn btn-primary" style={{ minWidth: "220px", justifyContent: "center" }}>
              Sign in with Email OTP &rarr;
            </Link>
          </div>
        </section>
      </div>
    );
  }

  // 3. Signed-In Home: 3 Pure Centered Choices (Borang Syarikat, Aduan Staf, Penilaian & Undian)
  return (
    <div className="app-home-stage">
      <div className="app-choice-grid">
        {/* TILE 1: FORMS */}
        <Link href="/forms/" className="app-choice-card app-card-forms">
          <div className="app-choice-icon-box forms-icon-box" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div className="app-choice-info">
            <h2 className="app-choice-title">Borang Syarikat</h2>
            <p className="app-choice-desc">Borang rasmi, permohonan servis &amp; rekod</p>
          </div>
          <div className="app-choice-chevron" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </Link>

        {/* TILE 2: COMPLAINTS */}
        <Link href="/tickets/" className="app-choice-card app-card-complaints">
          <div className="app-choice-icon-box complaints-icon-box" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="app-choice-info">
            <h2 className="app-choice-title">Aduan Staf</h2>
            <p className="app-choice-desc">Aduan sulit, salah laku &amp; rayuan tiket</p>
          </div>
          <div className="app-choice-chevron" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </Link>

        {/* TILE 3: VOTING & SCORING */}
        <Link href="/voting/" className="app-choice-card app-card-voting">
          <div className="app-choice-icon-box voting-icon-box" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div className="app-choice-info">
            <h2 className="app-choice-title">Penilaian &amp; Undian</h2>
            <p className="app-choice-desc">Markah sesi Rabu, undian staf &amp; laporan</p>
          </div>
          <div className="app-choice-chevron" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </Link>
      </div>

      <div className="app-home-footer">
        <button type="button" onClick={handleSignOut} className="app-home-signout-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Log Keluar ({profile.email})</span>
        </button>
      </div>
    </div>
  );
}
