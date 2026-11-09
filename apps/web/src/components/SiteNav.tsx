"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import BrandLogo from "./BrandLogo";
import { getSupabase, type SystemSetupState, type UserProfile } from "@/lib/supabase";

export default function SiteNav() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [needsSetup, setNeedsSetup] = useState<boolean>(false);

  useEffect(() => {
    const supabase = getSupabase();
    async function load() {
      const [{ data: stData }, { data: sessionData }] = await Promise.all([
        supabase.rpc("get_system_setup_state"),
        supabase.auth.getSession(),
      ]);
      const st = stData as SystemSetupState | null;
      setNeedsSetup(Boolean(st?.needs_first_maintenance));

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
  }, [pathname]);

  async function handleSignOut() {
    await getSupabase().auth.signOut();
    setProfile(null);
  }

  // Hide navbar completely on /setup or while initial setup is not yet completed
  if (pathname?.startsWith("/setup") || needsSetup) {
    return null;
  }

  return (
    <nav className="nav" aria-label="Primary">
      <div className="nav-links">
        <Link href="/" className="nav-brand">
          <BrandLogo size="sm" />
        </Link>
        <Link href="/forms/">Forms</Link>
        <Link href="/tickets/">Tickets</Link>
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
            <span className="badge">
              {profile.email} ({profile.role})
            </span>
            <button type="button" className="btn btn-secondary" onClick={handleSignOut}>
              Sign out
            </button>
          </>
        ) : (
          <Link href="/sign-in/" className="btn btn-secondary">
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
