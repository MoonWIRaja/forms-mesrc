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
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setMobileOpen(false);
  }

  async function handleSignOut() {
    await getSupabase().auth.signOut();
    setProfile(null);
  }

  // Hide navigation completely on /setup or while initial setup is needed
  if (pathname?.startsWith("/setup") || needsSetup) {
    return null;
  }

  const isDashboard = pathname === "/" || pathname === "";
  const isForms = pathname?.startsWith("/forms");
  const isTickets = pathname?.startsWith("/tickets");
  const isSubmissions = pathname === "/admin" || pathname === "/admin/";
  const isUsers = pathname?.startsWith("/users");
  const isFormBuilder = pathname?.startsWith("/admin/forms");
  const isSettings = pathname?.startsWith("/maintenance");
  const isStaff = profile?.role === "admin" || profile?.role === "maintenance";

  const navContent = (
    <>
      <div className="sidebar-brand">
        <Link href="/" className="sidebar-brand-link" aria-label="Forms MESRC Home">
          <BrandLogo size="md" subtitle="Workspace" />
        </Link>
      </div>

      <nav className="sidebar-menu" aria-label="Main Navigation">
        <div className="sidebar-section-label">Workspace</div>
        <Link href="/" className={`sidebar-item ${isDashboard ? "active" : ""}`}>
          <svg className="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span className="sidebar-item-text">Dashboard</span>
        </Link>

        <Link href="/forms/" className={`sidebar-item ${isForms ? "active" : ""}`}>
          <svg className="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            <path d="M9 12h6" />
            <path d="M9 16h6" />
          </svg>
          <span className="sidebar-item-text">Forms</span>
        </Link>

        <Link href="/tickets/" className={`sidebar-item ${isTickets ? "active" : ""}`}>
          <svg className="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
            <path d="M13 5v2" />
            <path d="M13 11v2" />
            <path d="M13 17v2" />
          </svg>
          <span className="sidebar-item-text">Tickets</span>
        </Link>

        {isStaff && (
          <>
            <div className="sidebar-section-label">Management</div>
            <Link href="/admin/" className={`sidebar-item ${isSubmissions ? "active" : ""}`}>
              <svg className="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
              </svg>
              <span className="sidebar-item-text">Submissions</span>
            </Link>

            <Link href="/users/" className={`sidebar-item ${isUsers ? "active" : ""}`}>
              <svg className="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span className="sidebar-item-text">Users &amp; Invites</span>
            </Link>

            <Link href="/admin/forms/" className={`sidebar-item ${isFormBuilder ? "active" : ""}`}>
              <svg className="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <span className="sidebar-item-text">Form Builder</span>
            </Link>
          </>
        )}

        {profile?.role === "maintenance" && (
          <>
            <div className="sidebar-section-label">System</div>
            <Link href="/maintenance/settings/" className={`sidebar-item ${isSettings ? "active" : ""}`}>
              <svg className="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span className="sidebar-item-text">Storage &amp; Settings</span>
            </Link>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        {profile ? (
          <div className="sidebar-profile-box">
            <div className="sidebar-user-info">
              <span className="sidebar-user-email" title={profile.email}>{profile.email}</span>
              <span className="badge badge-role">{profile.role}</span>
            </div>
            <button type="button" className="btn btn-secondary sidebar-signout-btn" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        ) : (
          <Link href="/sign-in/" className="btn btn-primary sidebar-signin-btn">
            Sign in
          </Link>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Top Floating Bar */}
      <div className="mobile-floating-bar" aria-label="Mobile Navigation Bar">
        <Link href="/" className="mobile-bar-brand">
          <BrandLogo size="sm" />
        </Link>
        <button
          type="button"
          className="btn btn-secondary mobile-toggle-btn"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? "✕ Close" : "☰ Menu"}
        </button>
      </div>

      {/* Mobile Floating Drawer */}
      {mobileOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setMobileOpen(false)}>
          <aside className="mobile-drawer-paper" onClick={(e) => e.stopPropagation()}>
            {navContent}
          </aside>
        </div>
      )}

      {/* Desktop Floating Sidebar */}
      <aside className="floating-sidebar" aria-label="Main Navigation">
        {navContent}
      </aside>
    </>
  );
}
