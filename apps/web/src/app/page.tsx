"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
    load();
  }, []);

  if (loading) {
    return (
      <ChunkLoader
        title="Loading Forms MESRC..."
        subtitle="Checking workspace status"
      />
    );
  }

  if (setupState?.needs_first_maintenance) {
    return (
      <section className="card stack">
        <div>
          <span className="badge" style={{ marginBottom: "0.6rem" }}>Initial Setup Required</span>
          <h1>Welcome to Forms MESRC</h1>
        </div>
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
    );
  }

  return (
    <section className="card stack">
      <h1>Forms MESRC</h1>
      <p className="notice">
        Company forms, appeals, and operational complaint tickets. Access is by invitation only.
      </p>
      {profile ? (
        <div className="row-actions">
          <Link href="/forms/" className="btn btn-primary">
            Open Forms
          </Link>
          <Link href="/tickets/" className="btn btn-secondary">
            Tickets
          </Link>
          {(profile.role === "admin" || profile.role === "maintenance") && (
            <Link href="/admin/" className="btn btn-secondary">
              Admin Workspace
            </Link>
          )}
          {profile.role === "maintenance" && (
            <>
              <Link href="/maintenance/" className="btn btn-secondary">
                Maintenance &amp; Invites
              </Link>
              <Link href="/maintenance/settings/" className="btn btn-secondary">
                Integration Settings
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="row-actions">
          <Link href="/sign-in/" className="btn btn-primary">
            Sign in with Email OTP
          </Link>
        </div>
      )}
    </section>
  );
}
