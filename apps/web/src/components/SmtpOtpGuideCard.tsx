"use client";

import { useState } from "react";
import InfoPopover from "./InfoPopover";

export const OTP_EMAIL_SUBJECT = "Kayangan Bumi Medical Verification Code: {{ slice .Token 0 4 }}";

export const OTP_EMAIL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kayangan Bumi Medical Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3efe4; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #12231a;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3efe4; padding: 40px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color: #fbf9f2; border: 2px solid #0f5132; border-radius: 8px; box-shadow: 5px 5px 0px #0f5132; overflow: hidden;">
          <tr>
            <td style="background-color: #0f5132; border-bottom: 3px solid #c59333; padding: 16px 28px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <strong style="font-size: 16px; font-weight: 800; letter-spacing: -0.3px; color: #ffffff;">
                      Kayangan Bumi Medical
                    </strong>
                  </td>
                  <td align="right">
                    <span style="font-size: 11px; font-weight: 700; padding: 3px 8px; border: 1.5px solid #c59333; border-radius: 4px; background-color: #fbf5e6; color: #0f5132;">
                      4-DIGIT OTP
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px;">
              <h1 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 800; color: #0f5132; letter-spacing: -0.4px;">
                Verification Passcode
              </h1>
              <p style="margin: 0 0 22px 0; font-size: 15px; line-height: 1.6; color: #475a50;">
                Enter the 4-digit verification code below in Kayangan Bumi Medical Forms to verify your email address:
              </p>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border: 2px solid #0f5132; border-radius: 6px; box-shadow: 3px 3px 0px #c59333; margin: 0 0 22px 0;">
                <tr>
                  <td style="padding: 22px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #475a50; margin-bottom: 8px;">
                      4-Digit Passcode
                    </div>
                    <div style="display: inline-block; max-width: 4ch; overflow: hidden; white-space: nowrap; font-family: 'Courier New', Courier, monospace; font-size: 40px; font-weight: 800; letter-spacing: 6px; color: #0f5132; line-height: 1.1;">{{ slice .Token 0 4 }}</div>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #475a50;">
                This 4-digit code expires in 10 minutes and can only be used once. Sent by <strong>support@mesrc.com.my</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 14px 28px; background-color: #eae3d2; border-top: 2px solid #0f5132; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #475a50;">
                Kayangan Bumi Medical &bull; Official Forms Portal
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export default function SmtpOtpGuideCard() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function copyText(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Fallback ignored
    }
  }

  return (
    <div className="stack">
      <div className="row-between">
        <div>
          <h2 style={{ marginBottom: "0.25rem" }}>
            Email Delivery, SMTP &amp; Complaint Alert Setup
          </h2>
          <p className="notice">
            Configure both Supabase Auth OTP emails and automated Staff Complaint alert delivery
            for <strong>Kayangan Bumi Medical</strong>.
          </p>
        </div>
        <InfoPopover title="Why configure this in Supabase Dashboard?">
          <p style={{ margin: "0 0 0.5rem 0" }}>
            Supabase Auth sends login OTP emails directly from its auth server, while Staff
            Complaint notifications are dispatched to authorized Admins via the{" "}
            <code>send-outbox-emails</code> Supabase Edge Function.
          </p>
          <ol style={{ margin: 0, paddingLeft: "1.25rem" }}>
            <li>
              Auth OTP emails come from <strong>support@mesrc.com.my</strong> via Google SMTP.
            </li>
            <li>
              Targeted complaint alerts go only to Admins enabled in Form Access &amp; Admin
              Permissions.
            </li>
          </ol>
        </InfoPopover>
      </div>

      <div className="grid-2">
        <div
          className="stack"
          style={{
            padding: "1rem",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            background: "var(--surface-muted)",
          }}
        >
          <strong>1. Custom SMTP (Google Workspace / Gmail)</strong>
          <p className="notice" style={{ fontSize: "0.86rem" }}>
            Open{" "}
            <a
              href="https://supabase.com/dashboard/project/uvjwepsawrbrhpywabdu/auth/smtp"
              target="_blank"
              rel="noreferrer"
            >
              Supabase &rarr; Auth &rarr; SMTP Settings
            </a>{" "}
            and enable <strong>Custom SMTP</strong> with:
          </p>
          <div style={{ fontSize: "0.88rem", display: "grid", gap: "0.35rem" }}>
            <div>
              <strong>Sender email:</strong> <code>support@mesrc.com.my</code>
            </div>
            <div>
              <strong>Sender name:</strong> <code>Kayangan Bumi Medical</code>
            </div>
            <div>
              <strong>Host:</strong> <code>smtp.gmail.com</code>
            </div>
            <div>
              <strong>Port:</strong> <code>587</code> (STARTTLS — <em>do not use 465</em>)
            </div>
            <div>
              <strong>Username:</strong> <code>support@mesrc.com.my</code>
            </div>
            <div>
              <strong>Password:</strong> <em>16-char Google App Password (no spaces)</em>
            </div>
          </div>
        </div>

        <div
          className="stack"
          style={{
            padding: "1rem",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            background: "var(--surface-muted)",
          }}
        >
          <strong>2. Clean OTP Email Template (Sign Up &amp; Magic Link)</strong>
          <p className="notice" style={{ fontSize: "0.86rem" }}>
            Open{" "}
            <a
              href="https://supabase.com/dashboard/project/uvjwepsawrbrhpywabdu/auth/templates"
              target="_blank"
              rel="noreferrer"
            >
              Supabase &rarr; Auth &rarr; Email Templates
            </a>
            . Paste into <strong>BOTH</strong> <em>Confirm sign up</em> and <em>Magic Link</em>{" "}
            tabs:
          </p>
          <div className="row-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => copyText("subject", OTP_EMAIL_SUBJECT)}
            >
              {copiedKey === "subject" ? "Copied Subject!" : "Copy Subject"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => copyText("html", OTP_EMAIL_HTML)}
            >
              {copiedKey === "html" ? "Copied HTML Template!" : "Copy HTML Body"}
            </button>
          </div>
        </div>
      </div>

      <div
        className="stack"
        style={{
          padding: "1rem",
          border: "1.5px solid var(--border-strong)",
          borderRadius: "var(--radius)",
          background: "var(--surface-tint)",
        }}
      >
        <strong>3. Automatic Invitation &amp; Staff Complaint Emails (Edge Function)</strong>
        <p className="notice" style={{ fontSize: "0.86rem", margin: 0 }}>
          Both <strong>Send Invitation</strong> emails and <strong>Staff Complaint</strong> alerts
          are delivered automatically via the <code>send-outbox-emails</code> Supabase Edge
          Function using your <strong>existing Google Workspace SMTP</strong> (<code>support@mesrc.com.my</code>) — no extra paid service required.
        </p>
        <div style={{ fontSize: "0.84rem", display: "grid", gap: "0.35rem" }}>
          <div>
            <strong>1. Deploy Edge Function:</strong> Open Supabase Dashboard &rarr;{" "}
            <strong>Edge Functions</strong> &rarr; create function named{" "}
            <code>send-outbox-emails</code> and paste{" "}
            <code>supabase/functions/send-outbox-emails/index.ts</code> (disable Verify JWT if prompted).
          </div>
          <div>
            <strong>2. Add Edge Function Secrets (Reuse your Gmail App Password):</strong>
            <br />
            <code>SMTP_USER</code> = <code>support@mesrc.com.my</code>
            <br />
            <code>SMTP_PASS</code> = <em>your 16-char Google App Password (no spaces)</em>
            <br />
            <code>EMAIL_FROM</code> ={" "}
            <code>Kayangan Bumi Medical &lt;support@mesrc.com.my&gt;</code>
          </div>
        </div>
      </div>
    </div>
  );
}
