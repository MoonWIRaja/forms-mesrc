"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import InvitationManager from "@/components/InvitationManager";
import { getSupabase, type UserProfile } from "@/lib/supabase";

export default function AdminPage() {
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
      <section className="card">
        <h1>Admin Workspace</h1>
        <p className="notice">
          Invite and manage Users. Form builder, submissions, appeals, and complaint tickets follow
          in Phases 3–6.
        </p>
      </section>

      <section className="card">
        <InvitationManager callerRole={profile.role} />
      </section>
    </div>
  );
}