"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabase, type UserProfile } from "@/lib/supabase";

export default function SiteNav() {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) {
        setProfile(null);
        return;
      }
      const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      setProfile((data as UserProfile | null) ?? null);
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await getSupabase().auth.signOut();
    setProfile(null);
  }

  return (
    <nav className="nav" aria-label="Primary">
      <div className="nav-links">
        <Link href="/">
          <strong>Forms MESRC</strong>
        </Link>
        <Link href="/forms/">Forms</Link>
        {(profile?.role === "admin" || profile?.role === "maintenance") && (
          <Link href="/admin/">Admin</Link>
        )}
        {profile?.role === "maintenance" && (
          <>
            <Link href="/maintenance/">Maintenance</Link>
            <Link href="/maintenance/settings/">Settings</Link>
          </>
        )}
      </div>
      <div className="nav-links">
        {profile ? (
          <>
            <span className="notice" style={{ fontSize: "0.88rem" }}>
              {profile.email} ({profile.role})
            </span>
            <button type="button" className="btn btn-secondary" onClick={handleSignOut}>
              Sign out
            </button>
          </>
        ) : (
          <Link href="/sign-in/">Sign in</Link>
        )}
      </div>
    </nav>
  );
}