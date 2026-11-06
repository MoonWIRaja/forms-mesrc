"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import InvitationManager from "@/components/InvitationManager";
import { getSupabase, type UserProfile } from "@/lib/supabase";

export default function MaintenancePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const supabase = getSupabase();
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        if (uid) {
          const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
          setProfile((data as UserProfile | null) ?? null);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <section className="card">
        <h1>Maintenance Workspace</h1>
        <p className="notice">Loading...</p>
      </section>
    );
  }

  if (!profile || profile.role !== "maintenance") {
    return (
      <section className="card stack">
        <h1>Access Denied</h1>
        <p className="notice">
          Only active Maintenance accounts may access the Maintenance workspace.
        </p>
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
          <h1>Maintenance Workspace</h1>
          <p className="notice">
            Manage invitations across all roles and configure Google Drive &amp; email integrations.
          </p>
        </div>
        <Link href="/maintenance/settings/" className="btn btn-primary">
          Open Integration Settings
        </Link>
      </section>

      <section className="card">
        <InvitationManager callerRole="maintenance" />
      </section>
    </div>
  );
}