// Supabase Edge Function: send-outbox-emails
// Drains pending rows in public.email_outbox and delivers transactional emails via Resend API.
//
// Required Supabase Edge Function Secrets:
//   RESEND_API_KEY   = re_xxxxxxxxxxxx (from https://resend.com)
//   EMAIL_FROM       = "Kayangan Bumi Medical <support@mesrc.com.my>"
//   SUPABASE_URL     = (auto-injected by Supabase)
//   SUPABASE_SERVICE_ROLE_KEY = (auto-injected by Supabase)
//
// Deploy command:
//   supabase functions deploy send-outbox-emails --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const emailFrom =
    Deno.env.get("EMAIL_FROM") || "Kayangan Bumi Medical <support@mesrc.com.my>";

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "Supabase environment secrets not configured." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!resendApiKey) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "RESEND_API_KEY secret is not configured in Supabase Edge Functions.",
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

  let sentCount = 0;
  let failedCount = 0;

  for (const row of (pendingRows as OutboxRow[] | null) ?? []) {
    const nextAttempts = (row.attempts ?? 0) + 1;
    try {
      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#f3efe4; padding:24px;">
          <div style="max-width:560px; margin:0 auto; background:#ffffff; border:2px solid #12231a; border-radius:10px; overflow:hidden;">
            <div style="background:#0f5132; color:#ffffff; padding:16px 22px; font-weight:800; font-size:15px;">
              Kayangan Bumi Medical &bull; Confidential Alert
            </div>
            <div style="padding:22px; color:#12231a; font-size:14px; line-height:1.6; white-space:pre-wrap;">
              ${row.body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
            </div>
            <div style="padding:12px 22px; background:#f5f1e6; border-top:1px solid #d5ccb8; font-size:12px; color:#5d6e63;">
              Sent automatically to authorized administrators only.
            </div>
          </div>
        </div>
      `;

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
    JSON.stringify({ ok: true, sent: sentCount, failed: failedCount }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
