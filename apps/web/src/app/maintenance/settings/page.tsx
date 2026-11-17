"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ChunkLoader from "@/components/ChunkLoader";
import GoogleDriveSetupForm, { type DriveConfigPublic } from "@/components/GoogleDriveSetupForm";
import SmtpOtpGuideCard from "@/components/SmtpOtpGuideCard";
import { getSupabase, type UserProfile } from "@/lib/supabase";

interface IntegrationStatusPayload {
  company: {
    company_name: string;
    timezone: string;
    setup_wizard_completed_at: string | null;
  };
  google_drive: {
    config_public: DriveConfigPublic;
    has_secret: boolean;
    validation_state: string;
    last_checked_at: string | null;
  };
}

export default function MaintenanceSettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<IntegrationStatusPayload | null>(null);
  const [activeTab, setActiveTab] = useState<"drive" | "smtp">("drive");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const supabase = getSupabase();
    const { data: stData, error: stErr } = await supabase.rpc("get_integration_settings_status");
    if (!stErr && stData) {
      setStatus(stData as IntegrationStatusPayload);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        if (!uid) {
          if (active) setProfile(null);
          return;
        }
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", uid)
          .maybeSingle();
        const typedProf = (prof as UserProfile | null) ?? null;
        if (active) setProfile(typedProf);

        if (typedProf?.role === "maintenance") {
          const { data: stData, error: stErr } = await supabase.rpc(
            "get_integration_settings_status",
          );
          if (stErr) throw stErr;
          if (active) setStatus(stData as IntegrationStatusPayload);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load integration settings.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setProfile(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <ChunkLoader
        title="Settings & Storage"
        subtitle="Loading configuration..."
      />
    );
  }

  if (!profile || profile.role !== "maintenance") {
    return (
      <div className="center-stage">
        <section className="card stack">
          <h1>Access Restricted</h1>
          <p className="notice">
            Only Maintenance accounts have access to System &amp; Storage Settings.
          </p>
          <div className="row-actions">
            <Link href="/" className="btn btn-primary">
              Return Home
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="stack" style={{ flex: 1 }}>
      <section
        className="card stack admin-full-card"
        style={{ flex: 1, height: "calc(100dvh - 2.5rem)", margin: 0, overflow: "hidden" }}
      >
        <div className="row-between" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <h2 style={{ margin: 0 }}>
            {activeTab === "drive" ? "Google Workspace Shared Drive" : "Email & OTP Guide"}
          </h2>

          <div className="row-actions" style={{ gap: "0.45rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className={`pixel-paper-btn compact ${activeTab === "drive" ? "primary" : ""}`}
              onClick={() => setActiveTab("drive")}
            >
              Google Drive Storage
            </button>
            <button
              type="button"
              className={`pixel-paper-btn compact ${activeTab === "smtp" ? "primary" : ""}`}
              onClick={() => setActiveTab("smtp")}
            >
              Email &amp; OTP Guide
            </button>
          </div>
        </div>

        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", paddingRight: "0.25rem" }}>
          {activeTab === "drive" ? (
            <GoogleDriveSetupForm
              initialConfig={status?.google_drive.config_public}
              initialHasSecret={status?.google_drive.has_secret}
              initialValidationState={status?.google_drive.validation_state}
              lastCheckedAt={status?.google_drive.last_checked_at}
              onSaved={refreshStatus}
            />
          ) : (
            <SmtpOtpGuideCard />
          )}
        </div>
      </section>
    </div>
  );
}
