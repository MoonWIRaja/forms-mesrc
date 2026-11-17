"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { getSupabase, type UserProfile } from "@/lib/supabase";

type DetectedPlatform = "iphone" | "android" | "desktop";

interface DeviceEnvironment {
  platform: DetectedPlatform;
  isPwa: boolean;
  label: string;
  hint: string | null;
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
  const [deviceEnv] = useState<DeviceEnvironment>(() =>
    detectDeviceEnvironment(),
  );

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

        <div className="ios-sheet-device-strip">
          <span className={`ios-device-pill ${deviceEnv.isPwa ? "pwa" : ""}`}>
            {deviceEnv.label}
          </span>
          <span className="ios-sheet-suffix">{profile.role.toUpperCase()}</span>
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
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modalNode, document.body);
}
