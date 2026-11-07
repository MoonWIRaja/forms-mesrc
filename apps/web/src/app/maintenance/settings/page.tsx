"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ChunkLoader from "@/components/ChunkLoader";
import GoogleDriveSetupForm, { type DriveConfigPublic } from "@/components/GoogleDriveSetupForm";
import InfoPopover from "@/components/InfoPopover";
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
        title="INSPECTING VAULT & SMTP SETTINGS..."
        subtitle="Checking Google Workspace Shared Drive & OTP integration status"
        variant="both"
      />
    );
  }

  if (!profile || profile.role !== "maintenance") {
    return (
      <section className="card stack">
        <h1>Access Denied</h1>
        <p className="notice">
          Only Maintenance accounts have access to Integration Settings. Admins do not have access
          to this page.
        </p>
        <div className="row-actions">
          <Link href="/sign-in/" className="btn btn-primary">
            Sign in
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="stack">
      <section className="card stack">
        <div className="row-between">
          <div>
            <h1>Maintenance Integration Settings</h1>
            <p className="notice">
              Configure Google Workspace Shared Drive storage and review email/OTP delivery guidance.
              Secrets are write-only and never returned after saving.
            </p>
          </div>
          <Link href="/maintenance/" className="btn btn-secondary">
            Back to Maintenance
          </Link>
        </div>
        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="card stack">
        <h2>Google Workspace Shared Drive Integration</h2>
        <GoogleDriveSetupForm
          initialConfig={status?.google_drive.config_public}
          initialHasSecret={status?.google_drive.has_secret}
          initialValidationState={status?.google_drive.validation_state}
          lastCheckedAt={status?.google_drive.last_checked_at}
          onSaved={refreshStatus}
        />
      </section>

      <section className="card stack">
        <div className="row-between">
          <h2>Email &amp; OTP Delivery (Supabase Auth SMTP)</h2>
          <InfoPopover title="Configuring Custom SMTP in Supabase Dashboard">
            <ol style={{ margin: 0, paddingLeft: "1.25rem" }}>
              <li>
                Open your{" "}
                <a
                  href="https://supabase.com/dashboard/project/uvjwepsawrbrhpywabdu/auth/templates"
                  target="_blank"
                  rel="noreferrer"
                >
                  Supabase Dashboard &rarr; Authentication &rarr; Emails
                </a>
                .
              </li>
              <li>
                Under <strong>SMTP Settings</strong>, enable Custom SMTP and enter your company
                Google Workspace / transactional SMTP host, port, sender address, and app credential.
              </li>
              <li>
                Under <strong>Email Templates &rarr; Magic Link / OTP</strong>, ensure the template
                includes <code>&#123;&#123; .Token &#125;&#125;</code> so recipients receive the
                6-digit verification code.
              </li>
            </ol>
          </InfoPopover>
        </div>
        <p className="notice">
          One-time passcodes (OTP) are sent by Supabase Auth. Click the <strong>i</strong> icon
          above for instructions on connecting your company SMTP sender and verifying the OTP email
          template.
        </p>
      </section>
    </div>
  );
}