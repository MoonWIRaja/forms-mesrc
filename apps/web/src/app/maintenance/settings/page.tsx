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
    <div className="stack">
      <section className="card stack">
        <div className="row-between">
          <div>
            <span className="badge" style={{ marginBottom: "0.4rem" }}>
              Admin Panel
            </span>
            <h1>Settings &amp; Storage</h1>
            <p className="notice">
              Configure Google Workspace Shared Drive storage and email/OTP settings.
            </p>
          </div>
          <div className="row-actions">
            <button
              type="button"
              className={`btn ${activeTab === "drive" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveTab("drive")}
            >
              Google Drive Storage
            </button>
            <button
              type="button"
              className={`btn ${activeTab === "smtp" ? "btn-primary" : "btn-secondary"}`}
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
      </section>

      {activeTab === "drive" ? (
        <section className="card stack">
          <h2>Google Workspace Shared Drive</h2>
          <GoogleDriveSetupForm
            initialConfig={status?.google_drive.config_public}
            initialHasSecret={status?.google_drive.has_secret}
            initialValidationState={status?.google_drive.validation_state}
            lastCheckedAt={status?.google_drive.last_checked_at}
            onSaved={refreshStatus}
          />
        </section>
      ) : (
        <section className="card stack">
          <SmtpOtpGuideCard />
        </section>
      )}
    </div>
  );
}
