"use client";

import { useState } from "react";
import InfoPopover from "./InfoPopover";

export const OTP_EMAIL_SUBJECT = "Forms MESRC Verification Code: {{ .Token }}";

export const OTP_EMAIL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Forms MESRC Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3efe6; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1c1917;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3efe6; padding: 40px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color: #faf8f5; border: 2px solid #1c1917; border-radius: 6px; box-shadow: 5px 5px 0px #1c1917; overflow: hidden;">
          <tr>
            <td style="background-color: #efeae0; border-bottom: 2px solid #1c1917; padding: 16px 28px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <strong style="font-size: 16px; font-weight: 800; letter-spacing: -0.3px; color: #1c1917;">
                      Forms MESRC
                    </strong>
                  </td>
                  <td align="right">
                    <span style="font-size: 11px; font-weight: 700; padding: 3px 8px; border: 1.5px solid #1c1917; border-radius: 4px; background-color: #faf8f5; color: #1c1917;">
                      OTP CODE
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px;">
              <h1 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 800; color: #1c1917; letter-spacing: -0.4px;">
                Verification Passcode
              </h1>
              <p style="margin: 0 0 22px 0; font-size: 15px; line-height: 1.6; color: #57534e;">
                Enter the 6-digit verification code below in Forms MESRC to verify your email address:
              </p>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border: 2px solid #1c1917; border-radius: 4px; box-shadow: 3px 3px 0px #1c1917; margin: 0 0 22px 0;">
                <tr>
                  <td style="padding: 22px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #57534e; margin-bottom: 6px;">
                      One-Time Passcode
                    </div>
                    <span style="font-family: 'SF Mono', Consolas, Monaco, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1c1917;">
                      {{ .Token }}
                    </span>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #57534e;">
                This code expires in 10 minutes and can only be used once. Sent by <strong>support@mesrc.com.my</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 14px 28px; background-color: #efeae0; border-top: 2px solid #1c1917; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #57534e;">
                Forms MESRC &bull; Invite-Only Workspace
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
          <h2 style={{ marginBottom: "0.25rem" }}>Google SMTP &amp; Custom OTP Email Setup</h2>
          <p className="notice">
            Replace the default Supabase sender and template so all OTP codes come from{" "}
            <strong>support@mesrc.com.my</strong> with the clean Forms MESRC paper journal layout.
          </p>
        </div>
        <InfoPopover title="Why configure this in Supabase Dashboard?">
          <p style={{ margin: "0 0 0.5rem 0" }}>
            Supabase Auth sends the initial sign-in and setup OTP emails directly from its backend
            auth server. Setting Custom SMTP &amp; Email Templates in your Supabase project ensures:
          </p>
          <ol style={{ margin: 0, paddingLeft: "1.25rem" }}>
            <li>Emails are sent from <strong>support@mesrc.com.my</strong> via Google SMTP instead of noreply@mail.app.supabase.io.</li>
            <li>Recipients see a <strong>6-digit OTP code box</strong> (<code>&#123;&#123; .Token &#125;&#125;</code>) instead of a default magic link.</li>
          </ol>
        </InfoPopover>
      </div>

      <div className="grid-2">
        <div className="stack" style={{ padding: "1rem", border: "1.5px solid var(--ink)", borderRadius: "var(--radius-sm)", background: "var(--surface-elevated)" }}>
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
            <div><strong>Sender email:</strong> <code>support@mesrc.com.my</code></div>
            <div><strong>Sender name:</strong> <code>Forms MESRC</code></div>
            <div><strong>Host:</strong> <code>smtp.gmail.com</code></div>
            <div><strong>Port:</strong> <code>587</code> (STARTTLS — <em>do not use 465</em>)</div>
            <div><strong>Username:</strong> <code>support@mesrc.com.my</code></div>
            <div><strong>Password:</strong> <em>16-char Google App Password (no spaces)</em></div>
          </div>
        </div>

        <div className="stack" style={{ padding: "1rem", border: "1.5px solid var(--ink)", borderRadius: "var(--radius-sm)", background: "var(--surface-elevated)" }}>
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
            . Paste into <strong>BOTH</strong> <em>Confirm sign up</em> and <em>Magic Link</em> tabs:
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
    </div>
  );
}
