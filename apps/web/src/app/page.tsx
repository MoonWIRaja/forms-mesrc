"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import ChunkLoader from "@/components/ChunkLoader";
import {
  PixelArrowRightIcon,
  PixelQuestionsIcon,
  PixelShieldAlertIcon,
  PixelStarIcon,
} from "@/components/PixelIcons";
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
        <ChunkLoader title="Forms MESRC" subtitle="Assembling papercraft workspace..." />
      </div>
    );
  }

  async function handleSignOut() {
    await getSupabase().auth.signOut();
    setProfile(null);
  }

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
            <Link href="/setup/" className="pixel-paper-btn primary">
              <span>Launch Setup Wizard</span>
              <PixelArrowRightIcon size={14} />
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="center-stage">
        <section className="card stack" style={{ textAlign: "center", alignItems: "center" }}>
          <BrandLogo size="lg" subtitle="Invite-Only Workspace" />
          <h1 style={{ fontSize: "1.25rem", margin: "0.55rem 0 0.2rem", fontWeight: 700 }}>
            Sign in to get started
          </h1>
          <p className="notice" style={{ maxWidth: "38ch", margin: "0.25rem 0 0.5rem" }}>
            Company portal for official forms, staff complaints, and voting evaluations. Sign in with
            your invited email to continue.
          </p>
          <div
            className="row-actions"
            style={{ justifyContent: "center", width: "100%", marginTop: "0.5rem" }}
          >
            <Link
              href="/sign-in/"
              className="pixel-paper-btn primary"
              style={{ minWidth: "220px", justifyContent: "center" }}
            >
              <span>Sign in with Email OTP</span>
              <PixelArrowRightIcon size={14} />
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app-home-stage">
      <div className="app-choice-grid">
        {/* TILE 1: COMPANY FORMS */}
        <Link href="/forms/?category=company_forms" className="app-choice-card app-card-forms">
          <div className="app-choice-icon-box forms-icon-box" aria-hidden="true">
            <PixelQuestionsIcon size={22} />
          </div>
          <div className="app-choice-info">
            <h2 className="app-choice-title">Company Forms</h2>
            <p className="app-choice-desc">
              Check-in / Check-out, service requests &amp; official records
            </p>
          </div>
          <div className="app-choice-chevron" aria-hidden="true">
            <PixelArrowRightIcon size={16} />
          </div>
        </Link>

        {/* TILE 2: STAFF COMPLAINTS */}
        <Link href="/tickets/" className="app-choice-card app-card-complaints">
          <div className="app-choice-icon-box complaints-icon-box" aria-hidden="true">
            <PixelShieldAlertIcon size={22} />
          </div>
          <div className="app-choice-info">
            <h2 className="app-choice-title">Staff Complaints</h2>
            <p className="app-choice-desc">
              Submit reports &amp; track live complaint resolution status
            </p>
          </div>
          <div className="app-choice-chevron" aria-hidden="true">
            <PixelArrowRightIcon size={16} />
          </div>
        </Link>

        {/* TILE 3: VOTING & EVALUATION */}
        <Link href="/voting/" className="app-choice-card app-card-voting">
          <div className="app-choice-icon-box voting-icon-box" aria-hidden="true">
            <PixelStarIcon size={22} />
          </div>
          <div className="app-choice-info">
            <h2 className="app-choice-title">Voting &amp; Evaluation</h2>
            <p className="app-choice-desc">
              Finalis MCEP judging, presentation star ratings &amp; polls
            </p>
          </div>
          <div className="app-choice-chevron" aria-hidden="true">
            <PixelArrowRightIcon size={16} />
          </div>
        </Link>
      </div>

      <div className="app-home-footer">
        <button
          type="button"
          onClick={handleSignOut}
          className="app-home-signout-btn"
          title={`Signed in as ${profile.email}`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
}
