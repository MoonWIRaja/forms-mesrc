"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ChunkLoader from "@/components/ChunkLoader";
import { getSupabase, type UserProfile } from "@/lib/supabase";

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        if (!uid) return;

        const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
        if (!active) return;
        const prof = (data as UserProfile | null) ?? null;
        setProfile(prof);
        if (prof) {
          setDisplayName(prof.display_name ?? "");
          setPhone(prof.phone ?? "");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setMsg(null);

    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || null,
          phone: phone.trim() || null,
        })
        .eq("id", profile.id);

      if (error) throw error;
      setMsg({ text: "Profile details updated successfully.", ok: true });
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              display_name: displayName.trim() || null,
              phone: phone.trim() || null,
            }
          : null,
      );
    } catch (err) {
      setMsg({
        text: err instanceof Error ? err.message : "Failed to update profile.",
        ok: false,
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <ChunkLoader title="User Profile" subtitle="Loading account profile..." />;
  }

  if (!profile) {
    return (
      <div className="center-stage">
        <section className="card stack">
          <h1>Sign In Required</h1>
          <p className="notice">Please sign in to view your profile.</p>
          <div className="row-actions">
            <Link href="/sign-in/" className="btn btn-primary">
              Sign In
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="stack" style={{ maxWidth: "680px", margin: "0 auto", width: "100%" }}>
      <section className="card row-between">
        <div>
          <span className="badge" style={{ marginBottom: "0.4rem" }}>
            Account Settings
          </span>
          <h1>My Profile</h1>
          <p className="notice">View and manage your account details and profile information.</p>
        </div>
        <Link href="/" className="btn btn-secondary">
          &larr; Back to Dashboard
        </Link>
      </section>

      {msg && (
        <p className={`alert ${msg.ok ? "alert-ok" : "alert-error"}`} role="status">
          {msg.text}
        </p>
      )}

      {/* Account Overview Card */}
      <section className="card stack">
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div
            className="sidebar-avatar-circle"
            style={{ width: "52px", height: "52px", fontSize: "1.2rem" }}
            aria-hidden="true"
          >
            {profile.email.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.15rem" }}>
              {profile.display_name || "Member Account"}
            </h2>
            <span className="notice" style={{ fontSize: "0.88rem" }}>
              {profile.email}
            </span>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem" }}>
              <span
                className={`badge ${
                  profile.role === "maintenance"
                    ? "badge-configured"
                    : profile.role === "admin"
                    ? "badge-admin"
                    : "badge-not_configured"
                }`}
              >
                Role: {profile.role}
              </span>
              <span className="badge badge-configured">
                {profile.is_active ? "Active Account" : "Suspended"}
              </span>
            </div>
          </div>
        </div>

        <div className="profile-dropdown-divider" style={{ margin: "0.75rem 0" }} />

        <form onSubmit={handleSave} className="stack">
          <div className="field">
            <label htmlFor="prof-email">Email Address</label>
            <input
              id="prof-email"
              type="email"
              value={profile.email}
              disabled
              style={{ background: "var(--surface-muted)", cursor: "not-allowed" }}
            />
            <span className="notice" style={{ fontSize: "0.78rem" }}>
              Your company email address is tied to your account invitations and cannot be changed.
            </span>
          </div>

          <div className="field">
            <label htmlFor="prof-name">Display Name</label>
            <input
              id="prof-name"
              type="text"
              placeholder="e.g. Raja Ahmad"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="field">
            <label htmlFor="prof-phone">Phone Number (Optional)</label>
            <input
              id="prof-phone"
              type="text"
              placeholder="e.g. +60 12-345 6789"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={30}
            />
          </div>

          <div className="row-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving Changes..." : "Save Profile Details"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
