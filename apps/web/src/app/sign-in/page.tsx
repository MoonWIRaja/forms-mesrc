"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import OtpBoxInput from "@/components/OtpBoxInput";
import {
  getSupabase,
  verifyFourDigitOtp,
  type SystemSetupState,
  type UserProfile,
} from "@/lib/supabase";

export default function SignInPage() {
  const [setupState, setSetupState] = useState<SystemSetupState | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.rpc("get_system_setup_state").then(({ data }) => {
      setSetupState((data as SystemSetupState | null) ?? null);
    });
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user?.id;
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", uid)
          .maybeSingle();
        setProfile((prof as UserProfile | null) ?? null);
      }
    });
  }, []);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const supabase = getSupabase();
      const normalized = email.trim().toLowerCase();

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
      setStep("otp");
      setInfo(`Verification code sent to ${normalized}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send OTP.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const supabase = getSupabase();
      const data = await verifyFourDigitOtp(email, otp);

      const uid = data.user?.id;
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", uid)
          .maybeSingle();
        setProfile((prof as UserProfile | null) ?? null);
      }
      setInfo("Signed in successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired 4-digit verification code.");
    } finally {
      setBusy(false);
    }
  }

  if (setupState?.needs_first_maintenance) {
    return (
      <div className="center-stage">
        <section className="card stack">
          <h1>First-Time System Setup Required</h1>
          <p className="notice">
            No Maintenance account has been configured yet. Complete the initial setup wizard before
            signing in.
          </p>
          <div className="row-actions">
            <Link href="/setup/" className="btn btn-primary">
              Go to First-Time Setup Wizard
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (profile) {
    return (
      <div className="center-stage">
        <section className="card stack">
          <h1>Signed In</h1>
          <p className="notice">
            You are signed in as <strong>{profile.email}</strong> (role:{" "}
            <code>{profile.role}</code>).
          </p>
          <div className="row-actions">
            <Link href="/forms/" className="btn btn-primary">
              Go to Forms
            </Link>
            {(profile.role === "admin" || profile.role === "maintenance") && (
              <Link href="/admin/" className="btn btn-secondary">
                Admin Workspace
              </Link>
            )}
            {profile.role === "maintenance" && (
              <Link href="/maintenance/" className="btn btn-secondary">
                Maintenance Workspace
              </Link>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="center-stage">
      <section className="card stack">
      <h1>Sign in to Forms MESRC</h1>
      <p className="notice">
        Invite-only access via email one-time passcode (OTP). Passwords are not used.
      </p>

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

      {step === "email" ? (
        <form onSubmit={handleRequestOtp} className="stack">
          <div className="field">
            <label htmlFor="si-email">Invited Email Address</label>
            <input
              id="si-email"
              type="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="row-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Checking & Sending..." : "Send Login OTP"}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="stack">
          <div className="field">
            <label>One-Time Passcode (OTP) sent to {email}</label>
            <OtpBoxInput value={otp} onChange={setOtp} disabled={busy} />
          </div>
          <div className="row-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Verifying..." : "Verify & Sign in"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => setStep("email")}
            >
              Use Different Email
            </button>
          </div>
        </form>
      )}
      </section>
    </div>
  );
}