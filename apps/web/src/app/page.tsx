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
            Complete the guided 3-step setup wizard to verify the first Maintenance email and
            connect your company Google Workspace Shared Drive.
          </p>
          <div className="row-actions">
            <Link href="/setup/" className="btn btn-primary">
              Launch Setup Wizard
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
          <h1 style={{ marginTop: "0.25rem" }}>Forms MESRC</h1>
          <p className="notice" style={{ maxWidth: "42ch" }}>
            Internal company portal for official forms, operational complaints, and appeals. Sign in
            with your invited email address to continue.
          </p>
          <div className="row-actions" style={{ justifyContent: "center", marginTop: "0.25rem" }}>
            <Link href="/sign-in/" className="btn btn-primary">
              Sign in with Email OTP
            </Link>
          </div>
        </section>
      </div>
    );
  }

  // 3. Signed-In Home: Pure 2-Choice Paper World Assembly (Forms vs Complaints/Appeals)
  return (
    <div className="paper-home-stage">
      <div className="paper-home-intro">
        <h1>How can we help you today?</h1>
        <p className="notice">
          Select an option below to fill out an official company form or submit a complaint / appeal.
        </p>
      </div>

      <div className="paper-choice-duo">
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

          <h2 className="paper-portal-title">Forms</h2>
          <p className="paper-portal-sub">
            Browse and complete official company forms and applications.
          </p>
          <span className="paper-portal-cta">Open Forms &rarr;</span>
        </Link>

        {/* CHOICE 2: ADUAN / TICKETS (Assembled Back -> Mid -> Front) */}
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

          <h2 className="paper-portal-title">Complaints &amp; Appeals</h2>
          <p className="paper-portal-sub">
            Submit a new operational complaint (aduan) or track your appeals.
          </p>
          <span className="paper-portal-cta">Open Tickets &rarr;</span>
        </Link>
      </div>
    </div>
  );
}
