"use client";

import React, { useState } from "react";
import { getSupabase, type UserProfile } from "@/lib/supabase";

interface ProfileSheetModalProps {
  profile: UserProfile;
  onClose: () => void;
  onUpdated?: (updated: UserProfile) => void;
}

export default function ProfileSheetModal({
  profile,
  onClose,
  onUpdated,
}: ProfileSheetModalProps) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const initials = (profile.display_name || profile.email || "U")
    .slice(0, 2)
    .toUpperCase();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const supabase = getSupabase();
      const nextName = displayName.trim() || null;
      const nextPhone = phone.trim() || null;
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: nextName,
          phone: nextPhone,
        })
        .eq("id", profile.id);

      if (error) throw error;
      const nextProfile: UserProfile = {
        ...profile,
        display_name: nextName,
        phone: nextPhone,
      };
      onUpdated?.(nextProfile);
      setMsg({ text: "Profile saved.", ok: true });
      setTimeout(() => {
        onClose();
      }, 450);
    } catch (err) {
      setMsg({
        text: err instanceof Error ? err.message : "Failed to save profile.",
        ok: false,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="ios-sheet-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="My Profile"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ios-sheet-card">
        <div className="ios-sheet-handle" aria-hidden="true" />

        <div className="ios-sheet-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <div className="sidebar-avatar-circle" aria-hidden="true">
              {initials}
            </div>
            <div>
              <h2 className="ios-sheet-title">My Profile</h2>
              <span className="ios-sheet-subtitle">{profile.email}</span>
            </div>
          </div>

          <button
            type="button"
            className="ios-sheet-close-btn"
            onClick={onClose}
            aria-label="Close profile sheet"
          >
            &times;
          </button>
        </div>

        {msg && (
          <p className={`alert ${msg.ok ? "alert-ok" : "alert-error"}`} role="status">
            {msg.text}
          </p>
        )}

        <form onSubmit={handleSave} className="ios-sheet-form">
          <div className="ios-sheet-field">
            <span className="ios-sheet-floating-label">Full name</span>
            <input
              type="text"
              placeholder="Full name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="ios-sheet-field">
            <span className="ios-sheet-floating-label">Phone number (optional)</span>
            <input
              type="text"
              placeholder="Phone number (optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={30}
            />
          </div>

          <div className="ios-sheet-field readonly">
            <span className="ios-sheet-floating-label">Company email &amp; role</span>
            <div className="ios-sheet-readonly-row">
              <span>{profile.email}</span>
              <span className="ios-sheet-suffix">{profile.role.toUpperCase()}</span>
            </div>
          </div>

          <div className="ios-sheet-actions">
            <button
              type="button"
              className="ios-sheet-btn cancel"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="ios-sheet-btn primary"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
