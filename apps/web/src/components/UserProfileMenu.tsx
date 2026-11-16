"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { UserProfile } from "@/lib/supabase";

interface UserProfileMenuProps {
  profile: UserProfile;
  onSignOut: () => void;
  compact?: boolean;
}

export default function UserProfileMenu({
  profile,
  onSignOut,
  compact = false,
}: UserProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const initials = profile.display_name
    ? profile.display_name.slice(0, 2).toUpperCase()
    : profile.email.slice(0, 2).toUpperCase();

  const isStaff = profile.role === "admin" || profile.role === "maintenance";

  return (
    <div className={`sidebar-profile-wrapper ${compact ? "compact-profile-wrapper" : ""}`} ref={containerRef}>
      <button
        type="button"
        className={`sidebar-profile-trigger ${open ? "active" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        title={profile.email}
      >
        <div className="sidebar-avatar-circle" aria-hidden="true">
          {initials}
        </div>
        {!compact && (
          <div className="sidebar-profile-meta">
            <span className="sidebar-profile-email">
              {profile.display_name || profile.email}
            </span>
            <span className="sidebar-profile-role">{profile.role}</span>
          </div>
        )}
        <svg
          className={`sidebar-profile-chevron ${open ? "open" : ""}`}
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
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>

      {open && (
        <div className="sidebar-profile-dropdown" role="menu">
          <div className="profile-dropdown-header">
            <div className="sidebar-avatar-circle sm" aria-hidden="true">
              {initials}
            </div>
            <div className="profile-dropdown-user">
              <strong className="profile-dropdown-name">
                {profile.display_name || "Member Account"}
              </strong>
              <span className="profile-dropdown-email">{profile.email}</span>
              <span
                className={`badge badge-role ${
                  profile.role === "maintenance"
                    ? "badge-configured"
                    : profile.role === "admin"
                    ? "badge-admin"
                    : "badge-not_configured"
                }`}
              >
                {profile.role.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="profile-dropdown-divider" />

          <Link
            href="/profile/"
            className="profile-dropdown-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>Profile</span>
          </Link>

          {isStaff && (
            <Link
              href="/admin/"
              className="profile-dropdown-item"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
              </svg>
              <span>Admin Panel</span>
            </Link>
          )}

          <div className="profile-dropdown-divider" />

          <button
            type="button"
            className="profile-dropdown-item logout-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  );
}
