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
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void load();
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

  const isStaff = profile?.role === "admin" || profile?.role === "maintenance";
  const isAdminPanelRoute =
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/users") ||
    pathname?.startsWith("/maintenance");

  // ==========================================================================
  // MODE 1: COMPACT USER PORTAL PILL (When on Home, Forms, or Tickets)
  // No cluttered sidebar; Forms & Tickets are chosen directly from Home.
  // ==========================================================================
  if (!isAdminPanelRoute) {
    const isHome = pathname === "/" || pathname === "";
    return (
      <header className="user-nav-header" aria-label="Workspace Header">
        <div className="user-nav-pill">
          <div className="user-nav-left">
            <Link href="/" className="user-nav-brand" aria-label="Forms MESRC Home">
              <BrandLogo size="sm" />
            </Link>
            {!isHome && (
              <Link href="/" className="pill-btn">
                &larr; Home
              </Link>
            )}
          </div>

          <div className="user-nav-right">
            {isStaff && (
              <Link href="/admin/" className="pill-btn pill-btn-admin">
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
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                </svg>
                Admin Panel
              </Link>
            )}

            {profile ? (
              <button type="button" className="pill-btn" onClick={handleSignOut}>
                Sign out
              </button>
            ) : (
              <Link href="/sign-in/" className="pill-btn pill-btn-admin">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
    );
  }

  // ==========================================================================
  // MODE 2: DEDICATED ADMIN PANEL FLOATING SIDEBAR
  // Appears only when inside /admin, /users, or /maintenance
  // ==========================================================================
  const isSubmissions = pathname === "/admin" || pathname === "/admin/";
  const isFormBuilder = pathname?.startsWith("/admin/forms");
  const isUsers = pathname?.startsWith("/users");
  const isSettings = pathname?.startsWith("/maintenance");

  const adminSidebarContent = (
    <>
      <div className="sidebar-brand">
        <Link href="/admin/" className="sidebar-brand-link" aria-label="Forms MESRC Admin Panel">
          <BrandLogo size="md" subtitle="Admin Panel" />
        </Link>
      </div>

      <nav className="sidebar-menu" aria-label="Admin Navigation">
        <div className="sidebar-section-label">Operations</div>

        <Link href="/admin/" className={`sidebar-item ${isSubmissions ? "active" : ""}`}>
          <svg
            className="sidebar-item-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
            <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
          </svg>
          <span className="sidebar-item-text">Submissions</span>
        </Link>

        <Link href="/admin/forms/" className={`sidebar-item ${isFormBuilder ? "active" : ""}`}>
          <svg
            className="sidebar-item-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          <span className="sidebar-item-text">Forms &amp; Builder</span>
        </Link>

        <Link href="/users/" className={`sidebar-item ${isUsers ? "active" : ""}`}>
          <svg
            className="sidebar-item-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span className="sidebar-item-text">Users &amp; Invites</span>
        </Link>

        <Link href="/tickets/" className="sidebar-item">
          <svg
            className="sidebar-item-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="sidebar-item-text">Tickets Queue</span>
        </Link>

        {profile?.role === "maintenance" && (
          <>
            <div className="sidebar-section-label">Configuration</div>
            <Link
              href="/maintenance/settings/"
              className={`sidebar-item ${isSettings ? "active" : ""}`}
            >
              <svg
                className="sidebar-item-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span className="sidebar-item-text">Settings &amp; Storage</span>
            </Link>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <Link href="/" className="btn btn-secondary sidebar-signout-btn">
          &larr; Back to Home
        </Link>

        {profile && (
          <div className="sidebar-profile-box">
            <div className="sidebar-user-info">
              <span className="sidebar-user-email" title={profile.email}>
                {profile.email}
              </span>
              <span className="badge badge-role">{profile.role}</span>
            </div>
            <button
              type="button"
              className="btn btn-secondary sidebar-signout-btn"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      <div className="mobile-floating-bar" aria-label="Mobile Admin Navigation">
        <Link href="/admin/" className="mobile-bar-brand">
          <BrandLogo size="sm" subtitle="Admin" />
        </Link>
        <button
          type="button"
          className="btn btn-secondary mobile-toggle-btn"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? "Close" : "Admin Menu"}
        </button>
      </div>

      {mobileOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setMobileOpen(false)}>
          <aside className="mobile-drawer-paper" onClick={(e) => e.stopPropagation()}>
            {adminSidebarContent}
          </aside>
        </div>
      )}

      <aside className="floating-sidebar" aria-label="Admin Sidebar">
        {adminSidebarContent}
      </aside>
    </>
  );
}
