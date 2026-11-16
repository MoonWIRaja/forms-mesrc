"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import ChunkLoader from "@/components/ChunkLoader";
import UserProfileMenu from "@/components/UserProfileMenu";
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

  // 3. Signed-In Home: 3-Pillar Paper Portal (Forms, Complaints, Voting & Scoring)
  return (
    <div className="paper-home-stage">
      <div className="paper-home-header-row">
        <BrandLogo size="sm" subtitle="Workspace" />
        <UserProfileMenu profile={profile} onSignOut={handleSignOut} compact />
      </div>

      <div className="paper-home-intro">
        <span className="badge badge-role" style={{ alignSelf: "center", marginBottom: "0.2rem" }}>
          {profile.role.toUpperCase()} WORKSPACE
        </span>
        <h1>Company Hub</h1>
        <p className="notice">
          Select a category below to submit forms, file complaints, or score sessions.
        </p>
      </div>

      <div className="paper-choice-trio">
        {/* CHOICE 1: FORMS (Assembled Back -> Mid -> Front) */}
        <Link href="/forms/" className="paper-portal-card paper-portal-forms">
          <div className="paper-diorama-stage" aria-hidden="true">
            <svg className="diorama-svg" viewBox="0 0 120 120" fill="none">
              {/* Layer 1 (Back): Folder backing cardstock */}
              <g className="diorama-layer-back">
                <rect
                  x="18"
                  y="20"
                  width="68"
                  height="82"
                  rx="10"
                  transform="rotate(-6 52 61)"
                  fill="#dbeafe"
                  stroke="#93b4f8"
                  strokeWidth="1.5"
                />
              </g>
              {/* Layer 2 (Mid): Main form sheet cardstock */}
              <g className="diorama-layer-mid">
                <rect
                  x="26"
                  y="16"
                  width="68"
                  height="84"
                  rx="10"
                  fill="#ffffff"
                  stroke="#18181b"
                  strokeWidth="1.8"
                />
                <rect x="36" y="28" width="28" height="6" rx="3" fill="#1d4ed8" />
                <rect x="36" y="42" width="48" height="5" rx="2.5" fill="#e2ddd4" />
                <rect x="36" y="54" width="48" height="5" rx="2.5" fill="#e2ddd4" />
                <rect x="36" y="66" width="34" height="5" rx="2.5" fill="#e2ddd4" />
              </g>
              {/* Layer 3 (Front): Mounted stamp badge */}
              <g className="diorama-layer-front">
                <circle
                  cx="82"
                  cy="82"
                  r="18"
                  fill="#1d4ed8"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />
                <path
                  d="M75 82.5L80 87.5L90 77.5"
                  stroke="#ffffff"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            </svg>
          </div>

          <div className="paper-portal-body">
            <span className="paper-card-badge badge-blue">Official Forms</span>
            <h2 className="paper-portal-title">Company Forms</h2>
            <p className="paper-portal-sub">
              Official company forms, requisition slips, and services.
            </p>
          </div>
          <span className="paper-portal-cta">
            <span className="cta-label">Open Forms</span>
            <span className="cta-arrow" aria-hidden="true">&rarr;</span>
          </span>
        </Link>

        {/* CHOICE 2: COMPLAINTS & TICKETS (Assembled Back -> Mid -> Front) */}
        <Link href="/tickets/" className="paper-portal-card paper-portal-tickets">
          <div className="paper-diorama-stage" aria-hidden="true">
            <svg className="diorama-svg" viewBox="0 0 120 120" fill="none">
              {/* Layer 1 (Back): Envelope/Support backing cardstock */}
              <g className="diorama-layer-back">
                <rect
                  x="22"
                  y="22"
                  width="72"
                  height="76"
                  rx="10"
                  transform="rotate(6 58 60)"
                  fill="#fef3c7"
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                />
              </g>
              {/* Layer 2 (Mid): Main ticket dispatch sheet */}
              <g className="diorama-layer-mid">
                <rect
                  x="22"
                  y="20"
                  width="72"
                  height="76"
                  rx="10"
                  fill="#ffffff"
                  stroke="#18181b"
                  strokeWidth="1.8"
                />
                <rect x="33" y="33" width="32" height="6" rx="3" fill="#b45309" />
                <rect x="33" y="47" width="50" height="5" rx="2.5" fill="#e2ddd4" />
                <rect x="33" y="59" width="42" height="5" rx="2.5" fill="#e2ddd4" />
                <rect x="33" y="71" width="26" height="5" rx="2.5" fill="#e2ddd4" />
              </g>
              {/* Layer 3 (Front): Mounted dialogue / resolution badge */}
              <g className="diorama-layer-front">
                <rect
                  x="64"
                  y="64"
                  width="36"
                  height="32"
                  rx="10"
                  fill="#b45309"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />
                <path
                  d="M75 76H89M75 83H84"
                  stroke="#ffffff"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
              </g>
            </svg>
          </div>

          <div className="paper-portal-body">
            <span className="paper-card-badge badge-amber">Confidential</span>
            <h2 className="paper-portal-title">Staff Complaints</h2>
            <p className="paper-portal-sub">
              Discreet grievance reporting for misconduct, harassment, or tickets.
            </p>
          </div>
          <span className="paper-portal-cta">
            <span className="cta-label">File Complaint</span>
            <span className="cta-arrow" aria-hidden="true">&rarr;</span>
          </span>
        </Link>

        {/* CHOICE 3: VOTING & EVALUATION (Assembled Back -> Mid -> Front) */}
        <Link href="/voting/" className="paper-portal-card paper-portal-voting">
          <div className="paper-diorama-stage" aria-hidden="true">
            <svg className="diorama-svg" viewBox="0 0 120 120" fill="none">
              {/* Layer 1 (Back): Emerald ballot sheet */}
              <g className="diorama-layer-back">
                <rect
                  x="20"
                  y="20"
                  width="70"
                  height="80"
                  rx="10"
                  transform="rotate(-5 55 60)"
                  fill="#d1fae5"
                  stroke="#34d399"
                  strokeWidth="1.5"
                />
              </g>
              {/* Layer 2 (Mid): Scorecard sheet */}
              <g className="diorama-layer-mid">
                <rect
                  x="24"
                  y="18"
                  width="72"
                  height="82"
                  rx="10"
                  fill="#ffffff"
                  stroke="#18181b"
                  strokeWidth="1.8"
                />
                <rect x="34" y="30" width="30" height="6" rx="3" fill="#047857" />
                <rect x="34" y="44" width="22" height="5" rx="2" fill="#059669" />
                <rect x="60" y="44" width="24" height="5" rx="2.5" fill="#e2ddd4" />
                <rect x="34" y="56" width="22" height="5" rx="2" fill="#059669" />
                <rect x="60" y="56" width="24" height="5" rx="2.5" fill="#e2ddd4" />
                <rect x="34" y="68" width="22" height="5" rx="2" fill="#059669" />
                <rect x="60" y="68" width="24" height="5" rx="2.5" fill="#e2ddd4" />
              </g>
              {/* Layer 3 (Front): Star rating / Ballot podium stamp */}
              <g className="diorama-layer-front">
                <circle cx="82" cy="82" r="18" fill="#047857" stroke="#ffffff" strokeWidth="2.5" />
                <path
                  d="M82 72L84.5 77.5L90.5 78.2L86 82.3L87.2 88.2L82 85.2L76.8 88.2L78 82.3L73.5 78.2L79.5 77.5L82 72Z"
                  fill="#fef08a"
                  stroke="#ca8a04"
                  strokeWidth="1"
                />
              </g>
            </svg>
          </div>

          <div className="paper-portal-body">
            <span className="paper-card-badge badge-green">Scoring &amp; Polls</span>
            <h2 className="paper-portal-title">Voting &amp; Scoring</h2>
            <p className="paper-portal-sub">
              Weekly Wednesday presentation grading (Speaker, Emcee, Coordinator) &amp; polls.
            </p>
          </div>
          <span className="paper-portal-cta">
            <span className="cta-label">Enter Voting</span>
            <span className="cta-arrow" aria-hidden="true">&rarr;</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
