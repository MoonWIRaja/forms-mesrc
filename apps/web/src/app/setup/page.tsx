"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ChunkLoader from "@/components/ChunkLoader";
import GoogleDriveSetupForm from "@/components/GoogleDriveSetupForm";
import InfoPopover from "@/components/InfoPopover";
import { getSupabase, type SystemSetupState, type UserProfile } from "@/lib/supabase";

type WizardStep = 1 | 2 | 3 | 4;

export default function FirstTimeSetupPage() {
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<WizardStep>(1);
  const [setupState, setSetupState] = useState<SystemSetupState | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [companyName, setCompanyName] = useState("MESRC");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const supabase = getSupabase();
        const [{ data: stateData }, { data: sessData }] = await Promise.all([
          supabase.rpc("get_system_setup_state"),
          supabase.auth.getSession(),
        ]);
        const st = stateData as SystemSetupState | null;
        setSetupState(st);

        const uid = sessData.session?.user?.id;
        if (uid) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", uid)
            .maybeSingle();
          const typedProf = (prof as UserProfile | null) ?? null;
          setProfile(typedProf);
          if (typedProf?.role === "maintenance") {
            setStep(st?.setup_wizard_completed ? 4 : 3);
            return;
          }
        }

        if (st && !st.needs_first_maintenance) {
          setStep(4);
        } else {
          setStep(1);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load setup state.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function handleStep1ClaimAndSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const supabase = getSupabase();
      const normalized = email.trim().toLowerCase();

      const { error: claimErr } = await supabase.rpc("claim_first_maintenance_email", {
        p_email: normalized,
        p_company_name: companyName.trim() || "MESRC",
      });
      if (claimErr) throw claimErr;

      const { error: eligErr } = await supabase.rpc("request_otp_eligibility", {
        p_email: normalized,
      });
      if (eligErr) throw eligErr;

      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: normalized,
        options: { shouldCreateUser: true },
      });
      if (otpErr) throw otpErr;

      setEmail(normalized);
      setStep(2);
      setInfo(`A one-time verification code has been sent to ${normalized}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start Maintenance setup.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStep2VerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const supabase = getSupabase();
      const { data, error: verifyErr } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp.trim(),
        type: "email",
      });
      if (verifyErr) throw verifyErr;

      const uid = data.user?.id;
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", uid)
          .maybeSingle();
        setProfile((prof as UserProfile | null) ?? null);
      }

      setStep(3);
      setInfo(
        "Email verified and first Maintenance account activated. Next, configure your company Google Workspace Shared Drive.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired OTP code.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <ChunkLoader
        title="CHECKING BOOTSTRAP CHUNKS..."
        subtitle="Inspecting first-time Maintenance setup & Shared Drive vault status"
        variant="both"
      />
    );
  }

  if (step === 4 && (!profile || profile.role !== "maintenance") && setupState && !setupState.needs_first_maintenance) {
    return (
      <section className="card stack">
        <h1>System Initialized</h1>
        <p className="notice">
          First-time Maintenance setup has already been completed. Please sign in with your invited
          or Maintenance email address.
        </p>
        <div className="row-actions">
          <Link href="/sign-in/" className="btn btn-primary">
            Go to Sign in
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="card stack">
      <div>
        <h1>First-Time System Setup Wizard</h1>
        <p className="notice">
          Complete these three steps once before opening Forms MESRC to staff and users.
        </p>
      </div>

      <div className="steps-bar" aria-label="Setup progress">
        <span className={`step-pill ${step === 1 ? "active" : step > 1 ? "done" : ""}`}>
          1. First Maintenance Email
        </span>
        <span className={`step-pill ${step === 2 ? "active" : step > 2 ? "done" : ""}`}>
          2. Verify Email OTP
        </span>
        <span className={`step-pill ${step === 3 ? "active" : step > 3 ? "done" : ""}`}>
          3. Google Drive Storage Setup
        </span>
      </div>

      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="alert alert-ok" role="status">
          {info}
        </p>
      )}

      {step === 1 && (
        <form onSubmit={handleStep1ClaimAndSendOtp} className="stack">
          <h2>Step 1: Register First Maintenance Account</h2>
          <p className="notice">
            No Maintenance account exists yet. Enter the primary Maintenance email address. We will
            send a one-time passcode (OTP) to verify ownership and permanently lock public
            bootstrap.
          </p>
          <div className="field">
            <label htmlFor="wiz-company">Company / Organization Name</label>
            <input
              id="wiz-company"
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="wiz-email">
              First Maintenance Email Address
              <InfoPopover title="Maintenance Role Authority">
                Maintenance accounts hold full system authority: they configure Google Drive and
                email integrations, manage company services, and can invite additional equivalent
                Maintenance peers, Admins, and Users.
              </InfoPopover>
            </label>
            <input
              id="wiz-email"
              type="email"
              required
              placeholder="maintenance@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="row-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Sending OTP..." : "Send Verification OTP"}
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleStep2VerifyOtp} className="stack">
          <h2>Step 2: Enter Email Verification Code</h2>
          <p className="notice">
            Enter the one-time verification code sent to <strong>{email}</strong>.
          </p>
          <div className="field">
            <label htmlFor="wiz-otp">One-Time Passcode (OTP)</label>
            <input
              id="wiz-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
          </div>
          <div className="row-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Verifying..." : "Verify & Activate Maintenance Account"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => setStep(1)}
            >
              Change Email
            </button>
          </div>
        </form>
      )}

      {step === 3 && (
        <div className="stack">
          <h2>Step 3: Configure Company Google Workspace Shared Drive</h2>
          <p className="notice">
            All form attachments are stored privately in your company Google Workspace Shared Drive
            under <code>Forms MESRC/&#123;user_id&#125;/&#123;submission_id&#125;</code> (up to 1
            GiB per file). Click the <strong>i</strong> icons for step-by-step setup instructions.
          </p>
          <GoogleDriveSetupForm isWizardStep onSaved={() => setStep(4)} />
          <div className="row-actions">
            <Link href="/maintenance/" className="btn btn-secondary">
              Skip for now &amp; open Maintenance Workspace
            </Link>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="stack">
          <h2>First-Time Setup Complete</h2>
          <p className="notice">
            Your Maintenance account and Google Drive storage configuration are ready. You can now
            invite additional Maintenance peers, Admins, or Users, or adjust settings at any time.
          </p>
          <div className="row-actions">
            <Link href="/maintenance/" className="btn btn-primary">
              Open Maintenance Workspace
            </Link>
            <Link href="/maintenance/settings/" className="btn btn-secondary">
              Review Integration Settings
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}