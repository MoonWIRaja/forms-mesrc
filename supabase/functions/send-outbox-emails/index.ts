// Supabase Edge Function: send-outbox-emails
// Drains pending rows in public.email_outbox and sends real emails (Invitations + Staff Complaint Alerts).
//
// Supports TWO providers automatically (configure whichever you prefer in Edge Function Secrets):
//   Option A — Google Workspace / Gmail SMTP (RECOMMENDED — uses your existing support@mesrc.com.my App Password!):
//     SMTP_USER  = support@mesrc.com.my
//     SMTP_PASS  = <16-char Google App Password without spaces>
//     SMTP_HOST  = smtp.gmail.com   (optional, default smtp.gmail.com)
//     SMTP_PORT  = 587              (optional, default 587)
//     EMAIL_FROM = Kayangan Bumi Medical <support@mesrc.com.my>  (optional)
//
//   Option B — Resend API:
//     RESEND_API_KEY = re_xxxxxxxxxxxx
//     EMAIL_FROM     = Kayangan Bumi Medical <support@mesrc.com.my>
//
// Deploy in Supabase Dashboard -> Edge Functions -> Deploy a new function -> name: send-outbox-emails

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.15";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OutboxRow {
  id: number;
  to_email: string;
  subject: string;
  body: string;
  attempts: number;
  max_attempts: number;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildBrandedHtml(subject: string, body: string): string {
  const inviteUrlMatch = body.match(/https?:\/\/[^\s]+\/invite\/accept\/\?token=[A-Za-z0-9_%-]+/);
  const inviteUrl = inviteUrlMatch?.[0] ?? null;
  const isInvite = Boolean(inviteUrl) || subject.toLowerCase().includes("invitation");
  const headerTag = isInvite ? "WORKSPACE INVITATION" : "CONFIDENTIAL ALERT";

  const safeBody = escapeHtml(body).replace(/\n/g, "<br/>");
  const ctaBlock = inviteUrl
    ? `
      <div style="margin: 24px 0 8px; text-align: center;">
        <a
          href="${escapeHtml(inviteUrl)}"
          style="display: inline-block; background-color: #0f5132; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 15px; padding: 13px 26px; border-radius: 8px; border: 2px solid #12231a; box-shadow: 3px 3px 0px #c59333;"
        >
          Accept Invitation &rarr;
        </a>
      </div>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f2ea;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#12231a;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f2ea;padding:32px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background-color:#fbfaf6;border:2px solid #0f5132;border-radius:10px;box-shadow:5px 5px 0px #0f5132;overflow:hidden;">
          <tr>
            <td style="background-color:#0f5132;border-bottom:3px solid #c59333;padding:16px 24px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <strong style="font-size:16px;font-weight:800;color:#ffffff;letter-spacing:-0.2px;">
                      Kayangan Bumi Medical
                    </strong>
                  </td>
                  <td align="right">
                    <span style="font-size:10px;font-weight:800;padding:3px 8px;border:1.5px solid #c59333;border-radius:4px;background-color:#fbf4e2;color:#0f5132;letter-spacing:0.6px;">
                      ${headerTag}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 24px;font-size:14px;line-height:1.65;color:#12231a;">
              ${safeBody}
              ${ctaBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:13px 24px;background-color:#ebe6d8;border-top:2px solid #0f5132;text-align:center;">
              <p style="margin:0;font-size:12px;color:#475a50;">
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
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const smtpUser = Deno.env.get("SMTP_USER")?.trim() || "";
  const smtpPass = Deno.env.get("SMTP_PASS")?.replace(/\s+/g, "") || "";
  const smtpHost = Deno.env.get("SMTP_HOST")?.trim() || "smtp.gmail.com";
  const smtpPort = Number(Deno.env.get("SMTP_PORT") || "587");
  const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim() || "";
  const emailFrom =
    Deno.env.get("EMAIL_FROM")?.trim() ||
    `Kayangan Bumi Medical <${smtpUser || "support@mesrc.com.my"}>`;

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "Supabase environment secrets not configured." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const useSmtp = Boolean(smtpUser && smtpPass);
  const useResend = !useSmtp && Boolean(resendApiKey);

  if (!useSmtp && !useResend) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          "Email secrets missing. Set SMTP_USER + SMTP_PASS (Gmail App Password) or RESEND_API_KEY in Supabase Edge Function Secrets.",
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: pendingRows, error: fetchErr } = await adminClient
    .from("email_outbox")
    .select("id,to_email,subject,body,attempts,max_attempts")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(20);

  if (fetchErr) {
    return new Response(
      JSON.stringify({ ok: false, error: fetchErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const rows = (pendingRows as OutboxRow[] | null) ?? [];
  if (rows.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, sent: 0, failed: 0, provider: useSmtp ? "smtp" : "resend" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const transporter = useSmtp
    ? nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      })
    : null;

  let sentCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const nextAttempts = (row.attempts ?? 0) + 1;
    try {
      const htmlBody = buildBrandedHtml(row.subject, row.body);

      if (transporter) {
        await transporter.sendMail({
          from: emailFrom,
          to: row.to_email,
          subject: row.subject,
          text: row.body,
          html: htmlBody,
        });
      } else {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: emailFrom,
            to: [row.to_email],
            subject: row.subject,
            text: row.body,
            html: htmlBody,
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Resend HTTP ${res.status}: ${errText}`);
        }
      }

      await adminClient
        .from("email_outbox")
        .update({
          status: "sent",
          attempts: nextAttempts,
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", row.id);
      sentCount += 1;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Delivery failed";
      errors.push(`${row.to_email}: ${errMsg}`);
      await adminClient
        .from("email_outbox")
        .update({
          status: nextAttempts >= (row.max_attempts ?? 5) ? "failed" : "pending",
          attempts: nextAttempts,
          last_error: errMsg.slice(0, 500),
        })
        .eq("id", row.id);
      failedCount += 1;
    }
  }

  return new Response(
    JSON.stringify({
      ok: sentCount > 0 || failedCount === 0,
      sent: sentCount,
      failed: failedCount,
      provider: useSmtp ? "smtp" : "resend",
      errors: errors.length > 0 ? errors : undefined,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
