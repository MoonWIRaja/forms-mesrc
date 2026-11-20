"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  canTriggerPwaInstall,
  subscribePwaInstall,
  triggerPwaInstall,
} from "@/lib/pwa-install";
import { getSupabase, type UserProfile } from "@/lib/supabase";

type DetectedPlatform = "iphone" | "android" | "desktop";

interface DeviceEnvironment {
  platform: DetectedPlatform;
  isPwa: boolean;
  label: string;
  hint: string | null;
}

interface ProfileTicketItem {
  id: string;
  form_id: string;
  user_id: string;
  kind: "appeal" | "complaint";
  reason: string;
  status: "open" | "taken" | "resolved" | "reopened" | "closed";
  resolution: string | null;
  created_at: string;
}

function detectDeviceEnvironment(): DeviceEnvironment {
  if (typeof window === "undefined") {
    return {
      platform: "desktop",
      isPwa: false,
      label: "Desktop · Web Browser",
      hint: null,
    };
  }

  const ua = navigator.userAgent || "";
  const isIpadOs =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const isIphoneOrIos = /iPhone|iPad|iPod/i.test(ua) || isIpadOs;
  const isAndroid = /Android/i.test(ua);

  const platform: DetectedPlatform = isIphoneOrIos
    ? "iphone"
    : isAndroid
      ? "android"
      : "desktop";

  const navStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  const displayStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const isPwa = navStandalone || displayStandalone;

  if (platform === "iphone") {
    return {
      platform,
      isPwa,
      label: isPwa ? "iPhone · PWA App" : "iPhone · Safari Web",
      hint: isPwa
        ? null
        : "Tip: Tap Share → Add to Home Screen for full-screen iPhone app mode.",
    };
  }

  if (platform === "android") {
    return {
      platform,
      isPwa,
      label: isPwa ? "Android · PWA App" : "Android · Mobile Web",
      hint: isPwa
        ? null
        : "Tip: Tap browser menu (⋮) → Install App for Android home screen access.",
    };
  }

  return {
    platform,
    isPwa,
    label: isPwa ? "Desktop · PWA App" : "Desktop · Web Browser",
    hint: null,
  };
}

function extractTicketSubtitle(reason: string): string {
  const parts = reason.split("|").map((p) => p.trim());
  const cat = parts.find((p) => /^complaint category:/i.test(p));
  const subj = parts.find((p) => /^complaint subject:/i.test(p) || /^subject:/i.test(p));
  const chosen = [cat?.replace(/^[^:]+:\s*/, ""), subj?.replace(/^[^:]+:\s*/, "")]
    .filter(Boolean)
    .join(" · ");
  if (chosen) return chosen;
  return reason.length > 72 ? `${reason.slice(0, 72)}...` : reason;
}

function statusPillLabel(status: ProfileTicketItem["status"]): string {
  switch (status) {
    case "open":
      return "Open";
    case "taken":
      return "In Review";
    case "resolved":
      return "Resolved";
    case "reopened":
      return "Reopened";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}

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
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"profile" | "tickets">("profile");
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [tickets, setTickets] = useState<ProfileTicketItem[]>([]);
  const [formTitles, setFormTitles] = useState<Record<string, string>>({});
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [deviceEnv] = useState<DeviceEnvironment>(() =>
    detectDeviceEnvironment(),
  );
  const [installReady, setInstallReady] = useState(() => canTriggerPwaInstall());

  useEffect(() => {
    return subscribePwaInstall(() => {
      setInstallReady(canTriggerPwaInstall());
    });
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: tRows, error: tErr } = await supabase
          .from("tickets")
          .select("id,form_id,user_id,kind,reason,status,resolution,created_at")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(30);

        if (!active) return;
        const list = !tErr && tRows ? (tRows as ProfileTicketItem[]) : [];
        setTickets(list);

        if (list.length > 0) {
          const uniqueFormIds = Array.from(new Set(list.map((t) => t.form_id)));
          const { data: fRows } = await supabase
            .from("forms")
            .select("id,title")
            .in("id", uniqueFormIds);
          if (active && fRows) {
            const map: Record<string, string> = {};
            for (const f of fRows as { id: string; title: string }[]) {
              map[f.id] = f.title;
            }
            setFormTitles(map);
          }
        }
      } finally {
        if (active) setTicketsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [profile.id]);

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

  const modalNode = (
    <div
      className={`ios-sheet-backdrop device-${deviceEnv.platform}`}
      role="dialog"
      aria-modal="true"
      aria-label="My Profile"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`ios-sheet-card device-${deviceEnv.platform}`}>
        {deviceEnv.platform !== "desktop" && (
          <div className="ios-sheet-handle" aria-hidden="true" />
        )}

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

        {/* Sleek Segmented Switcher: Account Profile | My Tickets */}
        <div className="ios-sheet-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "profile"}
            className={`ios-sheet-tab ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            Profile
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "tickets"}
            className={`ios-sheet-tab ${activeTab === "tickets" ? "active" : ""}`}
            onClick={() => setActiveTab("tickets")}
          >
            My Tickets
            {tickets.length > 0 && (
              <span className="ios-sheet-tab-count">{tickets.length}</span>
            )}
          </button>
        </div>

        {activeTab === "profile" ? (
          <>
            <div className="ios-sheet-device-strip">
              <span className={`ios-device-pill ${deviceEnv.isPwa ? "pwa" : ""}`}>
                {deviceEnv.label}
              </span>
              {installReady && !deviceEnv.isPwa && (
                <button
                  type="button"
                  className="ios-install-app-btn"
                  onClick={() => void triggerPwaInstall()}
                >
                  Install App
                </button>
              )}
            </div>

            {deviceEnv.hint && (
              <p className="ios-sheet-device-hint">{deviceEnv.hint}</p>
            )}

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
                <span className="ios-sheet-floating-label">Company email</span>
                <div className="ios-sheet-readonly-row">
                  <span>{profile.email}</span>
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
          </>
        ) : (
          <div className="ios-ticket-list">
            {ticketsLoading ? (
              <p className="notice" style={{ textAlign: "center", padding: "1.25rem 0", margin: 0 }}>
                Loading your tickets...
              </p>
            ) : tickets.length === 0 ? (
              <div className="ios-ticket-empty">
                <strong>No submitted tickets yet</strong>
                <p className="notice" style={{ margin: "0.2rem 0 0", fontSize: "0.8rem" }}>
                  Complaint tickets you submit will appear here so you can track live status and replies.
                </p>
              </div>
            ) : (
              tickets.map((t) => {
                const isResolved = t.status === "resolved" || t.status === "closed";
                const isReview = t.status === "taken";
                return (
                  <button
                    key={t.id}
                    type="button"
                    className="ios-ticket-item"
                    onClick={() => {
                      onClose();
                      router.push(`/tickets/ticket-id/?id=${encodeURIComponent(t.id)}`);
                    }}
                  >
                    <div className="ios-ticket-item-top">
                      <span className="ios-ticket-title">
                        {formTitles[t.form_id] || "Staff Complaint"}
                      </span>
                      <span
                        className={`ios-ticket-badge ${
                          isResolved || isReview ? "emerald" : "gold"
                        }`}
                      >
                        {statusPillLabel(t.status)}
                      </span>
                    </div>
                    <div className="ios-ticket-sub">{extractTicketSubtitle(t.reason)}</div>
                    <div className="ios-ticket-meta">
                      <span>#{t.id.slice(0, 8)}</span>
                      <span>{new Date(t.created_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modalNode, document.body);
}
