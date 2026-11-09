"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import OtpBoxInput from "@/components/OtpBoxInput";
import { getSupabase, verifyFourDigitOtp } from "@/lib/supabase";

interface InviteDetails {
  email: string;
  role: string;
  expires_at: string;
}

export default function InviteAcceptPage() {
  const [token, setToken] = useState("");
  const [details, setDetails] = useState<InviteDetails | null>(null);
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"inspect" | "otp" | "done">("inspect");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function inspectToken(rawToken: string) {
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data, error: rpcErr } = await supabase.rpc("inspect_invitation_token", {
        p_token: rawToken.trim(),
      });
      if (rpcErr) throw rpcErr;
      setDetails(data as InviteDetails);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired invitation token.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token") ?? "";
    if (!t) return;
    let active = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data, error: rpcErr } = await supabase.rpc("inspect_invitation_token", {
          p_token: t.trim(),
        });
        if (!active) return;
        setToken(t);
        if (rpcErr) throw rpcErr;
        setDetails(data as InviteDetails);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Invalid or expired invitation token.");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleSendOtp() {
    if (!details) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const supabase = getSupabase();
      const { error: eligErr } = await supabase.rpc("request_otp_eligibility", {
        p_email: details.email,
      });
      if (eligErr) throw eligErr;

      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: details.email,
        options: { shouldCreateUser: true },
      });
      if (otpErr) throw otpErr;

      setStep("otp");
      setInfo(`Verification code sent to ${details.email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!details) return;
    setBusy(true);
    setError(null);
    try {
      await verifyFourDigitOtp(details.email, otp);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired 4-digit OTP.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-stage">
      <section className="card stack">
        <BrandLogo size="md" subtitle="Workspace Invitation" />
        <h1>Accept Invitation</h1>
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

      {!details && step === "inspect" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            inspectToken(token);
          }}
          className="stack"
        >
          <p className="notice">Paste your invitation token to verify your invite:</p>
          <div className="field">
            <label htmlFor="inv-token">Invitation Token</label>
            <input
              id="inv-token"
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
          <div className="row-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Checking..." : "Verify Invitation"}
            </button>
          </div>
        </form>
      )}

      {details && step === "inspect" && (
        <div className="stack">
          <p>
            You have been invited to join <strong>Forms MESRC</strong> as{" "}
            <code>{details.role}</code> using <strong>{details.email}</strong>.
          </p>
          <p className="notice">
            Expires: {new Date(details.expires_at).toLocaleString()}
          </p>
          <div className="row-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={handleSendOtp}
            >
              {busy ? "Sending OTP..." : `Send Verification OTP to ${details.email}`}
            </button>
          </div>
        </div>
      )}

      {details && step === "otp" && (
        <form onSubmit={handleVerifyOtp} className="stack">
          <div className="field">
            <label>Enter the OTP sent to {details.email}</label>
            <OtpBoxInput value={otp} onChange={setOtp} disabled={busy} />
          </div>
          <div className="row-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Activating..." : "Verify OTP & Activate Account"}
            </button>
          </div>
        </form>
      )}

      {step === "done" && (
        <div className="stack">
          <p className="alert alert-ok">
            Your invitation has been accepted and your account is now active.
          </p>
          <div className="row-actions">
            <Link href="/forms/" className="btn btn-primary">
              Continue to Forms
            </Link>
          </div>
        </div>
      )}
      </section>
    </div>
  );
}