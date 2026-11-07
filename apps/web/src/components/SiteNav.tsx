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
        <Link href="/" className="nav-brand">
          {/* Custom Isometric Voxel Journal Book SVG */}
          <svg
            width="30"
            height="30"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect x="4" y="5" width="24" height="24" rx="2" fill="#18181b" />
            <rect x="2" y="3" width="24" height="24" rx="2" fill="#facc15" stroke="#18181b" strokeWidth="2.5" />
            <rect x="6" y="3" width="4" height="24" fill="#fb7185" stroke="#18181b" strokeWidth="2" />
            <rect x="13" y="8" width="9" height="4" fill="#ffffff" stroke="#18181b" strokeWidth="2" />
            <line x1="13" y1="16" x2="22" y2="16" stroke="#18181b" strokeWidth="2.5" />
            <line x1="13" y1="20" x2="19" y2="20" stroke="#18181b" strokeWidth="2.5" />
          </svg>
          <strong>Forms MESRC</strong>
        </Link>

        <Link href="/forms/" className="nav-tab">
          <span>[1]</span> Forms
        </Link>

        <Link href="/tickets/" className="nav-tab">
          <span>[2]</span> Tickets
        </Link>

        {(profile?.role === "admin" || profile?.role === "maintenance") && (
          <Link href="/admin/" className="nav-tab">
            <span>[3]</span> Admin
          </Link>
        )}

        {profile?.role === "maintenance" && (
          <>
            <Link href="/maintenance/" className="nav-tab">
              <span>[4]</span> Maintenance
            </Link>
            <Link href="/maintenance/settings/" className="nav-tab">
              <span>[5]</span> Settings
            </Link>
          </>
        )}
      </div>

      <div className="nav-links">
        {profile ? (
          <>
            <span className="brutal-tag tag-green">
              {profile.email} &bull; {profile.role.toUpperCase()}
            </span>
            <button type="button" className="btn btn-secondary" onClick={handleSignOut}>
              Sign out
            </button>
          </>
        ) : (
          <Link href="/sign-in/" className="btn btn-primary">
            Sign in [OTP]
          </Link>
        )}
      </div>
    </nav>
  );
}
